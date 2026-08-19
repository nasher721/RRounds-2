import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
	prefix: "",
	// Custom breakpoints for responsive design system
	screens: {
		'xs': '475px',
		'sm': '640px',
		'md': '768px',
		'lg': '1024px',
		'xl': '1280px',
		'2xl': '1536px',
		'3xl': '1920px',
		'max-md': { max: '767px' },
		'tablet': { min: '768px', max: '1023px' },
	},
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				sm: '640px',
				md: '768px',
				lg: '1024px',
				xl: '1200px',
				'2xl': '1200px'
			}
		},
		extend: {
			colors: {
				/* ------------------------------------------------------------------
				   LEDGERIX PALETTE OVERRIDE
				   ------------------------------------------------------------------
				   The app has ~1100 hard-coded palette classes (bg-amber-500,
				   text-slate-950, bg-green-50 …) that bypass the semantic token
				   layer. Rather than rewrite every call site — risky in clinical
				   alert and lab-value code, where each colour choice encodes
				   meaning — the ramps themselves are re-hued to the Ledgerix
				   palette. Every existing class keeps its authored intent and
				   picks up the new look.

				   Mapping:
				     slate/gray/zinc/neutral/stone -> green-cast neutrals
				     green/emerald/teal/cyan       -> clinical status TEAL, kept
				                                      off-hue from the brand green
				                                      so "normal" never reads as
				                                      a call-to-action
				     yellow -> amber -> orange -> red  severity gradation preserved
				                                      by walking the hue, so triage
				                                      ordering still reads
				     blue/sky/indigo               -> Ledgerix informational blue
				     violet/purple/fuchsia/pink    -> Ledgerix violet
				     lime                          -> brand green

				   The brand green itself stays reachable only through the token
				   layer (bg-primary, --primary), which is what keeps it scarce.
				   ------------------------------------------------------------------ */
				slate: { '50': '#f5f7f3', '100': '#eef1ea', '200': '#e2e6de', '300': '#cdd3c8', '400': '#a8b0a3', '500': '#8a9186', '600': '#6b7268', '700': '#4d5449', '800': '#333a30', '900': '#1a1d18', '950': '#0d0f0c' },
				gray: { '50': '#f5f7f3', '100': '#eef1ea', '200': '#e2e6de', '300': '#cdd3c8', '400': '#a8b0a3', '500': '#8a9186', '600': '#6b7268', '700': '#4d5449', '800': '#333a30', '900': '#1a1d18', '950': '#0d0f0c' },
				zinc: { '50': '#f5f7f3', '100': '#eef1ea', '200': '#e2e6de', '300': '#cdd3c8', '400': '#a8b0a3', '500': '#8a9186', '600': '#6b7268', '700': '#4d5449', '800': '#333a30', '900': '#1a1d18', '950': '#0d0f0c' },
				neutral: { '50': '#f5f7f3', '100': '#eef1ea', '200': '#e2e6de', '300': '#cdd3c8', '400': '#a8b0a3', '500': '#8a9186', '600': '#6b7268', '700': '#4d5449', '800': '#333a30', '900': '#1a1d18', '950': '#0d0f0c' },
				stone: { '50': '#f5f7f3', '100': '#eef1ea', '200': '#e2e6de', '300': '#cdd3c8', '400': '#a8b0a3', '500': '#8a9186', '600': '#6b7268', '700': '#4d5449', '800': '#333a30', '900': '#1a1d18', '950': '#0d0f0c' },
				green: { '50': '#f3f9f9', '100': '#e3f4f4', '200': '#c6eeed', '300': '#9de7e5', '400': '#6adcd8', '500': '#39d0cb', '600': '#1d7a77', '700': '#175e5c', '800': '#134442', '900': '#0e2d2c', '950': '#071313' },
				emerald: { '50': '#f3f9f9', '100': '#e3f4f4', '200': '#c6eeed', '300': '#9de7e5', '400': '#6adcd8', '500': '#39d0cb', '600': '#1d7a77', '700': '#175e5c', '800': '#134442', '900': '#0e2d2c', '950': '#071313' },
				teal: { '50': '#f3f9f9', '100': '#e3f4f4', '200': '#c6eeed', '300': '#9de7e5', '400': '#6adcd8', '500': '#39d0cb', '600': '#1d7a77', '700': '#175e5c', '800': '#134442', '900': '#0e2d2c', '950': '#071313' },
				cyan: { '50': '#f3f9f9', '100': '#e3f4f4', '200': '#c6eeed', '300': '#9de7e5', '400': '#6adcd8', '500': '#39d0cb', '600': '#1d7a77', '700': '#175e5c', '800': '#134442', '900': '#0e2d2c', '950': '#071313' },
				lime: { '50': '#f2faf6', '100': '#e0f8ed', '200': '#bef6dc', '300': '#8ff5c5', '400': '#55f1a8', '500': '#1ded8c', '600': '#0a7f49', '700': '#096037', '800': '#084227', '900': '#062818', '950': '#020b07' },
				red: { '50': '#faf3f3', '100': '#f6e2e3', '200': '#f1c3c4', '300': '#ed9799', '400': '#e56166', '500': '#dd2c32', '600': '#bd1f24', '700': '#9f1b20', '800': '#811a1e', '900': '#67191b', '950': '#4a1516' },
				rose: { '50': '#faf3f3', '100': '#f6e2e3', '200': '#f1c3c4', '300': '#ed9799', '400': '#e56166', '500': '#dd2c32', '600': '#bd1f24', '700': '#9f1b20', '800': '#811a1e', '900': '#67191b', '950': '#4a1516' },
				yellow: { '50': '#faf9f2', '100': '#f8f3df', '200': '#f7ecbd', '300': '#f8e28c', '400': '#f6d551', '500': '#f3c716', '600': '#856c07', '700': '#655206', '800': '#463907', '900': '#2b2306', '950': '#0d0b02' },
				amber: { '50': '#fbf7f2', '100': '#f8efdf', '200': '#f8e1bc', '300': '#f8cf8b', '400': '#f7b750', '500': '#f49f15', '600': '#996107', '700': '#794d07', '800': '#593a08', '900': '#3d2908', '950': '#1f1505' },
				orange: { '50': '#faf5f2', '100': '#f8e9e0', '200': '#f7d4bd', '300': '#f7b78d', '400': '#f49352', '500': '#f06f19', '600': '#af4d0b', '700': '#8e3f0b', '800': '#6f330c', '900': '#52280c', '950': '#341a0a' },
				blue: { '50': '#f2f5fa', '100': '#e1e8f7', '200': '#c1d2f3', '300': '#93b2f1', '400': '#5c8beb', '500': '#2565e4', '600': '#1851c3', '700': '#1645a4', '800': '#163b86', '900': '#15326a', '950': '#12264c' },
				sky: { '50': '#f2f5fa', '100': '#e1e8f7', '200': '#c1d2f3', '300': '#93b2f1', '400': '#5c8beb', '500': '#2565e4', '600': '#1851c3', '700': '#1645a4', '800': '#163b86', '900': '#15326a', '950': '#12264c' },
				indigo: { '50': '#f2f5fa', '100': '#e1e8f7', '200': '#c1d2f3', '300': '#93b2f1', '400': '#5c8beb', '500': '#2565e4', '600': '#1851c3', '700': '#1645a4', '800': '#163b86', '900': '#15326a', '950': '#12264c' },
				violet: { '50': '#f5f3fa', '100': '#e8e2f6', '200': '#d1c3f1', '300': '#b197ed', '400': '#8961e5', '500': '#612cdd', '600': '#4e1fbd', '700': '#431b9f', '800': '#391a81', '900': '#301967', '950': '#25154a' },
				purple: { '50': '#f5f3fa', '100': '#e8e2f6', '200': '#d1c3f1', '300': '#b197ed', '400': '#8961e5', '500': '#612cdd', '600': '#4e1fbd', '700': '#431b9f', '800': '#391a81', '900': '#301967', '950': '#25154a' },
				fuchsia: { '50': '#f5f3fa', '100': '#e8e2f6', '200': '#d1c3f1', '300': '#b197ed', '400': '#8961e5', '500': '#612cdd', '600': '#4e1fbd', '700': '#431b9f', '800': '#391a81', '900': '#301967', '950': '#25154a' },
				pink: { '50': '#f5f3fa', '100': '#e8e2f6', '200': '#d1c3f1', '300': '#b197ed', '400': '#8961e5', '500': '#612cdd', '600': '#4e1fbd', '700': '#431b9f', '800': '#391a81', '900': '#301967', '950': '#25154a' },
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					light: 'hsl(var(--primary-light))',
					dark: 'hsl(var(--primary-dark))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				medical: {
					blue: 'hsl(var(--medical-blue))',
					green: 'hsl(var(--medical-green))',
					red: 'hsl(var(--medical-red))',
					orange: 'hsl(var(--medical-orange))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-header': 'var(--gradient-header)',
				'gradient-success': 'var(--gradient-success)'
			},
		boxShadow: {
			'2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
			sm: '0 2px 4px 0 rgba(0, 0, 0, 0.04)',
			md: '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
			lg: '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
			xl: '0 20px 25px -5px rgba(0, 0, 0, 0.07), 0 10px 10px -5px rgba(0, 0, 0, 0.03)',
			'2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.12)',
			'glow': '0 0 20px rgba(var(--primary-rgb), 0.15)',
			card: '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
			'card-hover': '0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
			modal: '0 18px 50px -24px rgba(15, 23, 42, 0.35), 0 8px 20px -18px rgba(15, 23, 42, 0.2)',
			'float': '0 12px 36px -8px rgba(15, 23, 42, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.08)',
		},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 6px)',
				xl: 'calc(var(--radius) + 6px)',
				'2xl': 'calc(var(--radius) + 12px)',
				'3xl': 'calc(var(--radius) + 20px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0',
						opacity: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)',
						opacity: '1'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)',
						opacity: '1'
					},
					to: {
						height: '0',
						opacity: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(4px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'fade-out': {
					'0%': {
						opacity: '1',
						transform: 'translateY(0)'
					},
					'100%': {
						opacity: '0',
						transform: 'translateY(4px)'
					}
				},
				'scale-in': {
					'0%': {
						transform: 'scale(0.98)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				},
				shake: {
					'0%, 100%': {
						transform: 'translateX(0)'
					},
					'20%, 60%': {
						transform: 'translateX(-6px)'
					},
					'40%, 80%': {
						transform: 'translateX(6px)'
					}
				},
			'glow-pulse': {
				'0%, 100%': {
					boxShadow: '0 0 0 0 hsl(160 8% 55% / 0.2)'
				},
				'50%': {
					boxShadow: '0 0 20px 4px hsl(160 8% 55% / 0.1)'
				}
			},
			'stagger-fade-up': {
				'0%': {
					opacity: '0',
					transform: 'translateY(8px)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateY(0)'
				}
			}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'fade-out': 'fade-out 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				shake: 'shake 0.35s ease-in-out',
				'glow-pulse': 'glow-pulse 3s ease-in-out infinite'
			},
			fontFamily: {
			sans: [
				'Urbanist',
				'ui-sans-serif',
				'system-ui',
				'-apple-system',
				'BlinkMacSystemFont',
				'Segoe UI',
				'Roboto',
				'Helvetica Neue',
				'Arial',
				'Noto Sans',
				'sans-serif'
			],
			serif: [
				'Outfit',
				'ui-serif',
				'Georgia',
				'Cambria',
				'Times New Roman',
				'Times',
				'serif'
			],
			mono: [
				'SF Mono',
				'ui-monospace',
				'SFMono-Regular',
				'Menlo',
				'Monaco',
				'Consolas',
				'Liberation Mono',
				'Courier New',
				'monospace'
			]
			},
			fontSize: {
				xs: [
					'0.75rem',
					{
						lineHeight: '1rem'
					}
				],
				sm: [
					'0.875rem',
					{
						lineHeight: '1.25rem'
					}
				],
				base: [
					'1rem',
					{
						lineHeight: '1.5rem',
						letterSpacing: '0'
					}
				],
			lg: [
				'1.125rem',
				{
					lineHeight: '1.75rem',
					letterSpacing: '-0.01em'
				}
			],
			xl: [
				'1.25rem',
				{
					lineHeight: '1.75rem',
					letterSpacing: '-0.01em'
				}
			],
			'2xl': [
				'1.5rem',
				{
					lineHeight: '2rem',
					letterSpacing: '-0.02em'
				}
			],
			'3xl': [
				'1.875rem',
				{
					lineHeight: '2.25rem',
					letterSpacing: '-0.02em'
				}
			],
			'4xl': [
				'2.25rem',
				{
					lineHeight: '2.5rem',
					letterSpacing: '-0.03em'
				}
			],
			'5xl': [
				'3rem',
				{
					lineHeight: '1.2',
					letterSpacing: '-0.03em'
				}
			]
			},
			spacing: {
				'18': '4.5rem',
				'22': '5.5rem'
			},
			containers: {
				'xs': '320px',
				'sm': '384px',
				'md': '448px',
				'lg': '512px',
				'xl': '576px',
				'2xl': '672px',
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
