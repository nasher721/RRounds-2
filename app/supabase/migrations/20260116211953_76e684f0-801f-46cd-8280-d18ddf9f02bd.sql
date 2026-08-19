-- Create enum for phrase trigger types
CREATE TYPE public.phrase_trigger_type AS ENUM ('autotext', 'hotkey', 'context_menu', 'smart_suggestion');

-- Create enum for field types in dynamic forms
CREATE TYPE public.phrase_field_type AS ENUM ('text', 'number', 'date', 'dropdown', 'checkbox', 'radio', 'patient_data', 'calculation', 'conditional');

-- Create phrase folders table (hierarchical organization)
CREATE TABLE public.phrase_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_id UUID, -- NULL for personal folders
  parent_id UUID REFERENCES public.phrase_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create clinical phrases table
CREATE TABLE public.clinical_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  folder_id UUID REFERENCES public.phrase_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL, -- Template content with placeholders like {{field_name}}
  shortcut TEXT, -- Autotext trigger (e.g., ".sob")
  hotkey TEXT, -- Keyboard shortcut (e.g., "ctrl+shift+1")
  context_triggers JSONB DEFAULT '{}', -- {noteType: [], section: [], timeOfDay: []}
  is_active BOOLEAN DEFAULT TRUE,
  is_shared BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create phrase fields table (dynamic form fields)
CREATE TABLE public.phrase_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase_id UUID REFERENCES public.clinical_phrases(id) ON DELETE CASCADE NOT NULL,
  field_key TEXT NOT NULL, -- Key used in content template {{field_key}}
  field_type phrase_field_type NOT NULL,
  label TEXT NOT NULL,
  placeholder TEXT,
  default_value TEXT,
  options JSONB, -- For dropdown/radio: [{value, label}], for patient_data: {source: "age"|"mrn"|"labs.creatinine"}
  validation JSONB, -- {required, min, max, pattern, etc.}
  conditional_logic JSONB, -- {if: {field: "fieldKey", operator: "equals", value: "x"}, then: "show"|"hide"|"value"}
  calculation_formula TEXT, -- For calculation type: "bmi = weight / (height * height)"
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create phrase version history table
CREATE TABLE public.phrase_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase_id UUID REFERENCES public.clinical_phrases(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  fields_snapshot JSONB,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create phrase usage audit log
CREATE TABLE public.phrase_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phrase_id UUID REFERENCES public.clinical_phrases(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  target_field TEXT, -- Which field the phrase was inserted into
  input_values JSONB, -- Values entered in the form (no PHI in stored content)
  inserted_content TEXT, -- Final expanded content
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create team libraries table
CREATE TABLE public.phrase_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create team membership table
CREATE TABLE public.phrase_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.phrase_teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(team_id, user_id)
);

-- Create learned phrases table (for autocomplete suggestions)
CREATE TABLE public.learned_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text_pattern TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  suggested_as_phrase BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, text_pattern)
);

-- Enable RLS on all tables
ALTER TABLE public.phrase_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phrase_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learned_phrases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for phrase_folders
CREATE POLICY "Users can view their own and shared folders"
ON public.phrase_folders FOR SELECT
USING (auth.uid() = user_id OR is_shared = true);

CREATE POLICY "Users can create their own folders"
ON public.phrase_folders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
ON public.phrase_folders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
ON public.phrase_folders FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for clinical_phrases
CREATE POLICY "Users can view their own and shared phrases"
ON public.clinical_phrases FOR SELECT
USING (auth.uid() = user_id OR is_shared = true);

CREATE POLICY "Users can create their own phrases"
ON public.clinical_phrases FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own phrases"
ON public.clinical_phrases FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own phrases"
ON public.clinical_phrases FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for phrase_fields
CREATE POLICY "Users can view fields of accessible phrases"
ON public.phrase_fields FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.clinical_phrases p 
  WHERE p.id = phrase_id AND (p.user_id = auth.uid() OR p.is_shared = true)
));

CREATE POLICY "Users can manage fields of their phrases"
ON public.phrase_fields FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.clinical_phrases p 
  WHERE p.id = phrase_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can update fields of their phrases"
ON public.phrase_fields FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.clinical_phrases p 
  WHERE p.id = phrase_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can delete fields of their phrases"
ON public.phrase_fields FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.clinical_phrases p 
  WHERE p.id = phrase_id AND p.user_id = auth.uid()
));

-- RLS Policies for phrase_versions
CREATE POLICY "Users can view versions of accessible phrases"
ON public.phrase_versions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.clinical_phrases p 
  WHERE p.id = phrase_id AND (p.user_id = auth.uid() OR p.is_shared = true)
));

CREATE POLICY "Users can create versions of their phrases"
ON public.phrase_versions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.clinical_phrases p 
  WHERE p.id = phrase_id AND p.user_id = auth.uid()
));

-- RLS Policies for phrase_usage_log
CREATE POLICY "Users can view their own usage logs"
ON public.phrase_usage_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own usage logs"
ON public.phrase_usage_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for phrase_teams
CREATE POLICY "Users can view teams they belong to"
ON public.phrase_teams FOR SELECT
USING (
  owner_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.phrase_team_members m WHERE m.team_id = id AND m.user_id = auth.uid())
);

CREATE POLICY "Users can create teams"
ON public.phrase_teams FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their teams"
ON public.phrase_teams FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their teams"
ON public.phrase_teams FOR DELETE
USING (auth.uid() = owner_id);

-- RLS Policies for phrase_team_members
CREATE POLICY "Team members can view membership"
ON public.phrase_team_members FOR SELECT
USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.phrase_teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
);

CREATE POLICY "Team admins can manage members"
ON public.phrase_team_members FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.phrase_teams t WHERE t.id = team_id AND t.owner_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.phrase_team_members m WHERE m.team_id = team_id AND m.user_id = auth.uid() AND m.role = 'admin')
);

CREATE POLICY "Team admins can update members"
ON public.phrase_team_members FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.phrase_teams t WHERE t.id = team_id AND t.owner_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.phrase_team_members m WHERE m.team_id = team_id AND m.user_id = auth.uid() AND m.role = 'admin')
);

CREATE POLICY "Team admins can remove members"
ON public.phrase_team_members FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.phrase_teams t WHERE t.id = team_id AND t.owner_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.phrase_team_members m WHERE m.team_id = team_id AND m.user_id = auth.uid() AND m.role = 'admin')
);

-- RLS Policies for learned_phrases
CREATE POLICY "Users can view their own learned phrases"
ON public.learned_phrases FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own learned phrases"
ON public.learned_phrases FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learned phrases"
ON public.learned_phrases FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learned phrases"
ON public.learned_phrases FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_phrases_user_id ON public.clinical_phrases(user_id);
CREATE INDEX idx_phrases_folder_id ON public.clinical_phrases(folder_id);
CREATE INDEX idx_phrases_shortcut ON public.clinical_phrases(shortcut) WHERE shortcut IS NOT NULL;
CREATE INDEX idx_phrase_fields_phrase_id ON public.phrase_fields(phrase_id);
CREATE INDEX idx_phrase_versions_phrase_id ON public.phrase_versions(phrase_id);
CREATE INDEX idx_phrase_usage_user_id ON public.phrase_usage_log(user_id);
CREATE INDEX idx_learned_phrases_user_pattern ON public.learned_phrases(user_id, text_pattern);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_phrase_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers
CREATE TRIGGER update_phrase_folders_updated_at
BEFORE UPDATE ON public.phrase_folders
FOR EACH ROW EXECUTE FUNCTION public.update_phrase_updated_at();

CREATE TRIGGER update_clinical_phrases_updated_at
BEFORE UPDATE ON public.clinical_phrases
FOR EACH ROW EXECUTE FUNCTION public.update_phrase_updated_at();

CREATE TRIGGER update_phrase_teams_updated_at
BEFORE UPDATE ON public.phrase_teams
FOR EACH ROW EXECUTE FUNCTION public.update_phrase_updated_at();

CREATE TRIGGER update_learned_phrases_updated_at
BEFORE UPDATE ON public.learned_phrases
FOR EACH ROW EXECUTE FUNCTION public.update_phrase_updated_at();