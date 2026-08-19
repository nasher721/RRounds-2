/**
 * HL7 v2.x Parser
 * Supports ADT (Admissions, Transfers, Discharges), ORU (Observations), and MDM (Documents) messages
 */
import { defaultSystems, type Patient } from '@/types/patient';

/* Extended patient with full details for import */
export interface PatientWithDetails extends Patient {
  allergies?: string[];
  primaryDiagnosis?: string;
  attendingPhysician?: string;
  dischargeSummary?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
}

export interface HL7Segment {
  name: string;
  fields: string[];
}

export interface HL7Message {
  segments: HL7Segment[];
  messageType: HL7MessageType;
  timestamp: Date;
  triggerEvent: string;
  messageControlId: string;
}

export interface HL7MessageType {
  trigger: string;    // e.g., 'A01', 'A02', 'A03' for ADT
  event: string;      // e.g., 'ADT', 'ORU', 'MDM'
  structure: string;  // e.g., 'ADT_A01', 'ORU_R01'
}

export interface ADTMessage extends HL7Message {
  messageType: HL7MessageType & {
    event: 'ADT';
    trigger: 'A01' | 'A02' | 'A03' | 'A04' | 'A08' | 'A11' | 'A12' | 'A13';
  };
  patient: {
    mrn: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    address?: string;
    phone?: string;
  };
  visit: {
    admitDateTime?: string;
    dischargeDateTime?: string;
    patientClass?: string;
    patientType?: string;
    assignedLocation?: string;
    attendingPhysician?: string;
    diagnosis?: string[];
  };
}

export interface ORUMessage extends HL7Message {
  messageType: HL7MessageType & { event: 'ORU'; trigger: 'R01' };
  patient: {
    mrn: string;
    firstName: string;
    lastName: string;
  };
  observations: ORUObservation[];
}

export interface ORUObservation {
  observationId: string;
  value: string;
  unit?: string;
  timestamp: string;
  resultStatus?: string;
  referenceRange?: string;
}

export interface MDMMessage extends HL7Message {
  messageType: HL7MessageType & { event: 'MDM'; trigger: 'T01' | 'T02' };
  patient: {
    mrn: string;
    firstName: string;
    lastName: string;
  };
  documents: MDMDocument[];
}

export interface MDMDocument {
  documentId: string;
  documentType?: string;
  dateTime?: string;
  author?: string;
  content?: string;
}

class HL7Parser {
  private fieldSeparator: string = '|';
  private componentSeparator: string = '^';
  private repetitionSeparator: string = '~';
  private escapeCharacter: string = '\\';
  private subcomponentSeparator: string = '&';

  /**
   * Parse raw HL7 message string into structured object
   */
  parse(rawMessage: string): HL7Message | null {
    try {
      const segments = this.parseSegments(rawMessage);
      if (segments.length === 0) return null;

      const mshSegment = segments.find(s => s.name === 'MSH');
      if (!mshSegment) return null;

      const messageType = this.parseMessageType(mshSegment);
      const timestamp = this.parseTimestamp(mshSegment);
      const messageControlId = this.getField(mshSegment, 10) || '';

      return {
        segments,
        messageType,
        timestamp,
        triggerEvent: messageType.trigger,
        messageControlId
      };
    } catch (error) {
      console.error('HL7 parse error:', error);
      return null;
    }
  }

  /**
   * Parse HL7 message string into segments
   */
  private parseSegments(rawMessage: string): HL7Segment[] {
    const lines = rawMessage.split(/\r\n|\n|\r/);
    return lines
      .filter(line => line.trim().length > 0)
      .map(line => {
        const fields = line.split(this.fieldSeparator);
        const name = fields[0] || '';
        return {
          name,
          fields: fields.slice(1)
        };
      });
  }

  /**
   * Extract message type from MSH segment
   */
  private parseMessageType(mshSegment: HL7Segment): HL7MessageType {
    const messageTypeField = this.getField(mshSegment, 9) || '';
    const parts = messageTypeField.split(this.componentSeparator);
    return {
      event: parts[0] || '',
      trigger: parts[1] || '',
      structure: parts[2] || ''
    };
  }

  /**
   * Parse timestamp from MSH segment
   */
  private parseTimestamp(mshSegment: HL7Segment): Date {
    const timestamp = this.getField(mshSegment, 7) || '';
    if (timestamp.length >= 8) {
      const year = parseInt(timestamp.substring(0, 4));
      const month = parseInt(timestamp.substring(4, 6)) - 1;
      const day = parseInt(timestamp.substring(6, 8));
      let hour = 0, minute = 0, second = 0;
      if (timestamp.length >= 12) {
        hour = parseInt(timestamp.substring(8, 10));
        minute = parseInt(timestamp.substring(10, 12));
      }
      if (timestamp.length >= 14) {
        second = parseInt(timestamp.substring(12, 14));
      }
      return new Date(year, month, day, hour, minute, second);
    }
    return new Date();
  }

  /**
   * Get field by index (1-based)
   */
  getField(segment: HL7Segment, index: number): string {
    if (segment.name === 'MSH') {
      if (index === 1) return this.fieldSeparator;
      return segment.fields[index - 2] || '';
    }
    return segment.fields[index - 1] || '';
  }

  /**
   * Get component from field
   */
  getComponent(field: string, index: number): string {
    const components = field.split(this.componentSeparator);
    return components[index - 1] || '';
  }

  /**
   * Parse ADT message (Admit, Transfer, Discharge)
   */
  parseADT(message: HL7Message): ADTMessage | null {
    if (message.messageType.event !== 'ADT') return null;

    const pidSegment = message.segments.find(s => s.name === 'PID');
    const pv1Segment = message.segments.find(s => s.name === 'PV1');
    const dg1Segments = message.segments.filter(s => s.name === 'DG1');

    if (!pidSegment) return null;

    const patientId = this.getComponent(this.getField(pidSegment, 3), 1);
    const nameField = this.getField(pidSegment, 5);
    const nameParts = nameField.split(this.componentSeparator);

    const patient = {
      mrn: patientId,
      lastName: nameParts[0] || '',
      firstName: nameParts[1] || '',
      dateOfBirth: this.convertHL7Date(this.getField(pidSegment, 7)),
      gender: this.getField(pidSegment, 8),
      address: this.formatAddress(pidSegment),
      phone: this.getPhone(pidSegment)
    };

    const visit: ADTMessage['visit'] = {};
    if (pv1Segment) {
      visit.patientClass = this.getField(pv1Segment, 2);
      visit.patientType = this.getField(pv1Segment, 4);
      visit.assignedLocation = this.formatLocation(pv1Segment);
      visit.attendingPhysician = this.formatName(pv1Segment, 9);
      visit.admitDateTime = this.convertHL7DateTime(this.getField(pv1Segment, 44));
      visit.dischargeDateTime = this.convertHL7DateTime(this.getField(pv1Segment, 45));
    }

    const diagnosis: string[] = [];
    dg1Segments.forEach(dg1 => {
      const diagnosisCode = this.getField(dg1, 3);
      const diagnosisDesc = this.getField(dg1, 4);
      if (diagnosisCode || diagnosisDesc) {
        diagnosis.push(diagnosisCode ? `${diagnosisCode}: ${diagnosisDesc}` : diagnosisDesc);
      }
    });
    visit.diagnosis = diagnosis.length > 0 ? diagnosis : undefined;

    return {
      ...message,
      messageType: message.messageType as ADTMessage['messageType'],
      patient,
      visit
    };
  }

  /**
   * Parse ORU message (Observation Result)
   */
  parseORU(message: HL7Message): ORUMessage | null {
    if (message.messageType.event !== 'ORU') return null;

    const pidSegment = message.segments.find(s => s.name === 'PID');
    const obxSegments = message.segments.filter(s => s.name === 'OBR' || s.name === 'OBX');

    if (!pidSegment) return null;

    const patientId = this.getComponent(this.getField(pidSegment, 3), 1);
    const nameField = this.getField(pidSegment, 5);
    const nameParts = nameField.split(this.componentSeparator);

    const patient = {
      mrn: patientId,
      lastName: nameParts[0] || '',
      firstName: nameParts[1] || ''
    };

    const observations: ORUObservation[] = [];
    obxSegments.forEach(obx => {
      if (obx.name !== 'OBX') return;
      const valueField = this.getField(obx, 5);
      if (!valueField) return;

      observations.push({
        observationId: this.getField(obx, 3) || '',
        value: valueField,
        unit: this.getField(obx, 6) || undefined,
        timestamp: this.convertHL7DateTime(this.getField(obx, 14)) || '',
        resultStatus: this.getField(obx, 11),
        referenceRange: this.getField(obx, 7) || undefined
      });
    });

    return {
      ...message,
      messageType: message.messageType as ORUMessage['messageType'],
      patient,
      observations
    };
  }

  /**
   * Parse MDM message (Medical Document Management)
   */
  parseMDM(message: HL7Message): MDMMessage | null {
    if (message.messageType.event !== 'MDM') return null;

    const pidSegment = message.segments.find(s => s.name === 'PID');
    const txaSegments = message.segments.filter(s => s.name === 'TXA');

    if (!pidSegment) return null;

    const patientId = this.getComponent(this.getField(pidSegment, 3), 1);
    const nameField = this.getField(pidSegment, 5);
    const nameParts = nameField.split(this.componentSeparator);

    const patient = {
      mrn: patientId,
      lastName: nameParts[0] || '',
      firstName: nameParts[1] || ''
    };

    const documents: MDMDocument[] = [];
    txaSegments.forEach(txa => {
      documents.push({
        documentId: this.getField(txa, 2) || '',
        documentType: this.getField(txa, 1) || undefined,
        dateTime: this.convertHL7DateTime(this.getField(txa, 3)),
        author: this.getField(txa, 6) || undefined,
        content: this.getField(txa, 19) || undefined
      });
    });

    return {
      ...message,
      messageType: message.messageType as MDMMessage['messageType'],
      patient,
      documents
    };
  }

  /**
   * Convert HL7 date to ISO date string (YYYY-MM-DD)
   */
  private convertHL7Date(dateField: string): string | undefined {
    if (!dateField || dateField.length < 8) return undefined;
    const year = dateField.substring(0, 4);
    const month = dateField.substring(4, 6);
    const day = dateField.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  /**
   * Convert HL7 datetime to ISO datetime string
   */
  private convertHL7DateTime(dateTimeField: string): string | undefined {
    if (!dateTimeField || dateTimeField.length < 8) return undefined;
    const date = this.convertHL7Date(dateTimeField);
    if (dateTimeField.length >= 12) {
      const hour = dateTimeField.substring(8, 10);
      const minute = dateTimeField.substring(10, 12);
      return `${date}T${hour}:${minute}:00`;
    }
    return date;
  }

  /** Format a Date as an HL7 compact timestamp (YYYYMMDDHHmmss). */
  private formatHL7DateTime(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join('');
  }

  /**
   * Format address from PID segment
   */
  private formatAddress(pidSegment: HL7Segment): string | undefined {
    const addressField = this.getField(pidSegment, 11);
    if (!addressField) return undefined;
    const parts = addressField.split(this.componentSeparator);
    const street = parts[0] || '';
    const city = parts[2] || '';
    const state = parts[3] || '';
    const zip = parts[4] || '';
    return [street, city, state, zip].filter(Boolean).join(', ');
  }

  /**
   * Get phone from PID segment
   */
  private getPhone(pidSegment: HL7Segment): string | undefined {
    const phoneField = this.getField(pidSegment, 14);
    if (!phoneField) return undefined;
    const parts = phoneField.split(this.componentSeparator);
    return parts[0] || undefined;
  }

  /**
   * Format location from PV1 segment
   */
  private formatLocation(pv1Segment: HL7Segment): string | undefined {
    const locationField = this.getField(pv1Segment, 3);
    if (!locationField) return undefined;
    const parts = locationField.split(this.componentSeparator);
    return parts.join(' ');
  }

  /**
   * Format name from PV1 segment
   */
  private formatName(pv1Segment: HL7Segment, fieldIndex: number): string | undefined {
    const nameField = this.getField(pv1Segment, fieldIndex);
    if (!nameField) return undefined;
    const parts = nameField.split(this.componentSeparator);
    return parts.join(' ');
  }

  /**
   * Convert HL7 message to patient data
   */
  toPatientData(message: ADTMessage | ORUMessage | MDMMessage): Partial<PatientWithDetails> {
    if (message.messageType.event === 'ADT' && 'patient' in message) {
      const adt = message as ADTMessage;
      return {
        name: `${adt.patient.firstName} ${adt.patient.lastName}`,
        mrn: adt.patient.mrn,
        dateOfBirth: adt.patient.dateOfBirth,
        gender: this.normalizeGender(adt.patient.gender),
        systems: {
          ...defaultSystems,
          neuro: adt.visit.diagnosis?.join('\n') || '',
        },
        // Map additional fields as needed
      };
    }

    return {};
  }

  private normalizeGender(gender: string | undefined): PatientWithDetails['gender'] {
    switch (gender?.toUpperCase()) {
      case 'M':
      case 'MALE':
        return 'male';
      case 'F':
      case 'FEMALE':
        return 'female';
      case 'O':
      case 'OTHER':
        return 'other';
      default:
        return undefined;
    }
  }

  /**
   * Create HL7 ACK message for acknowledgment
   */
  createACK(originalMessage: HL7Message, acknowledgmentCode: 'AA' | 'AE' | 'AR'): string {
    const timestamp = this.formatHL7DateTime(new Date());
    const msh = `MSH|^~\\&|RRNOTES|${originalMessage.segments[0].fields[2] || ''}|${originalMessage.segments[0].fields[3] || ''}|RRNOTES|${timestamp}||ACK^A01|${originalMessage.messageControlId}|P|2.5.1|||AL|AL|||||ZFA^ACK`;
    const msa = `MSA|${acknowledgmentCode}|${originalMessage.messageControlId}`;
    return `${msh}\r${msa}`;
  }
}

export const hl7Parser = new HL7Parser();
export default hl7Parser;
