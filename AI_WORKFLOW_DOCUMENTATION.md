# Dental Cloud Application - Comprehensive AI Assistant Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture & Components](#architecture--components)
3. [Business Workflows](#business-workflows)
4. [Data Models & Relationships](#data-models--relationships)
5. [AI Interaction Patterns](#ai-interaction-patterns)
6. [API Actions & Endpoints](#api-actions--endpoints)
7. [Technical Implementation](#technical-implementation)

## Overview

The Dental Cloud application is a comprehensive dental clinic management system with an integrated AI assistant (Loli) designed to help dental professionals with clinical decision support, administrative tasks, and data analysis. The system handles patient management, appointments, treatments, inventory, and financial operations.

### Core Features:
- Patient management with medical histories
- Appointment scheduling and management
- Treatment recording and tracking
- Inventory management for medicines and supplies
- Financial operations and reporting
- Doctor scheduling and management
- Loyalty program management
- AI-powered clinical assistance

## Architecture & Components

### AI Assistant View (AIAssistantView.tsx)
The main component responsible for AI interactions, featuring:
- Dual-mode operation: Ask Mode (read-only analysis) and Agent Mode (CRUD operations)
- Context-aware conversation management
- Markdown-enhanced response rendering
- Session management and history
- Speech-to-text functionality
- Mock API simulation for development

### Core Data Models
- **Patient**: Personal information, medical history, contact details, balance, loyalty points
- **Appointment**: Patient-doctor-date-time relationship with status tracking
- **ClinicalRecord/Treatment**: Treatment descriptions, costs, teeth involved
- **Doctor**: Medical professionals with specializations, schedules, and commission percentage
- **TreatmentType**: Standardized treatment procedures with costs
- **Medicine**: Inventory items with stock levels, pricing, categories
- **Expense**: Business expenses with categories and dates
- **User**: System users with roles and permissions

## Business Workflows

### 1. Patient Management Workflow
**Primary Operations:**
- Patient registration and profile creation
- Medical history documentation
- Contact information management
- Balance and payment tracking
- Loyalty point management

**Key Processes:**
```
1. Patient Inquiry
2. Registration (if new patient)
3. Medical History Review
4. Treatment Planning
5. Appointment Scheduling
6. Treatment Execution
7. Payment Processing
8. Follow-up Scheduling
```

**AI Integration Points:**
- Patient search and lookup
- Medical history analysis
- Balance checking
- Loyalty program management
- Patient communication templates

### 2. Appointment Scheduling Workflow
**Primary Operations:**
- Booking appointments between registered patients and doctors
- Booking unregistered marketing lead appointments with guest name, phone, source, and follow-up notes without creating a patient record first
- Rescheduling and cancellation
- Status tracking (Scheduled, Completed, Cancelled)
- Availability checking for doctors

**Updated Admin Appointment Form:**
- The appointment modal starts with **Appointment For**: choose **Registered Patient** for an existing patient record or **New Patient** for an unregistered lead.
- Registered Patient appointments require selecting the patient. New Patient lead appointments require **New Patient Name** and **New Patient Phone**, with optional **New Patient Source** and **New Patient Follow-up Notes**.
- Doctor selection is optional and uses a searchable doctor field; the appointment can be saved with no specific doctor.
- Scheduling fields are **Date**, **Time**, **Type**, **Status**, and **Branch / Location**. Status values are Scheduled, Completed, and Cancelled; Scheduled is the normal default.
- Appointment clinical details are stored in structured notes as **Clinical Focus** and **Extra Notes**. When the AI creates appointments, it should populate `clinical_focus` and `n` / `extra_notes` so the form can parse them back correctly.
- Lead appointments stay as appointment-only records until converted. Do not create a patient profile for a New Patient / lead appointment unless the user explicitly asks to register or convert that lead.

**Key Processes:**
```
1. Patient Identification
2. Doctor Selection
3. Time Slot Selection
4. Appointment Creation
5. Confirmation
6. Pre-visit Reminders
7. Status Updates
8. Follow-up Scheduling
```

**AI Integration Points:**
- Availability checking
- Conflict resolution
- Bulk appointment scheduling
- Doctor workload balancing

### 3. Treatment Recording Workflow
**Primary Operations:**
- Recording completed treatments
- Associated tooth numbering
- Cost calculation and billing
- Medicine prescription and dispensing
- Treatment history maintenance

**Key Processes:**
```
1. Patient Verification
2. Clinical Examination
3. Treatment Planning
4. Treatment Execution
5. Documentation
6. Billing/Payment Processing
7. Follow-up Recommendation
8. Progress Tracking
```

**AI Integration Points:**
- Treatment type suggestions
- Cost estimation
- Medicine inventory checks
- Clinical protocol guidance
- Insurance claim preparation

### 4. Inventory Management Workflow
**Primary Operations:**
- Medicine/Supply tracking
- Stock level monitoring
- Reordering alerts
- Sales tracking
- Expiration date management

**Key Processes:**
```
1. Initial Stock Setup
2. Usage Tracking
3. Low Stock Alerts
4. Reorder Suggestions
5. Purchase Order Generation
6. Stock Receiving
7. Inventory Auditing
8. Expiration Monitoring
```

**AI Integration Points:**
- Automated reorder suggestions
- Stock level optimization
- Supplier recommendations
- Cost analysis
- Fast-moving item identification

### 5. Financial Operations Workflow
**Primary Operations:**
- Payment processing
- Revenue tracking
- Expense management
- Financial reporting
- Insurance claims processing

**Key Processes:**
```
1. Service/Billing Generation
2. Payment Collection
3. Revenue Recording
4. Expense Tracking
5. Account Reconciliation
6. Financial Reporting
7. Tax Preparation
8. Audit Trail Maintenance
```

**AI Integration Points:**
- Revenue forecasting
- Expense categorization
- Profit margin analysis
- Financial trend identification
- Payment plan recommendations

## Data Models & Relationships

### Patient Model
- `id`: Unique identifier
- `name`: Patient's full name
- `email`, `phone`: Contact information
- `medicalHistory`: Medical conditions, allergies, medications
- `balance`: Outstanding balance in MMK
- `loyalty_points`: Accumulated loyalty points
- `created_at`, `updated_at`: Timestamps

### Appointment Model
- `id`: Unique identifier
- `patient_id`, `doctor_id`: Foreign keys
- `date`, `time`: Scheduled date/time
- `status`: Scheduled, Completed, Cancelled, No-show
- `type`: Appointment type (checkup, cleaning, emergency, etc.)
- `notes`: Additional information

### Clinical Record/Treatment Model
- `id`: Unique identifier
- `patient_id`: Foreign key to patient
- `teeth`: Array of affected teeth using adult FDI numbers and baby labels `1A-4E`
- `description`: Treatment details
- `cost`: Treatment cost in MMK
- `date`: Date of treatment

### Doctor Commission (Percentage-Based Earnings)
- `commission_percentage` on Doctor: 0-100%, set in the Doctor tab
- When a treatment is recorded, the system looks up the treating doctor's commission_percentage
- `doctorEarnings = treatment_cost × (commission_percentage / 100)`
- The calculated earnings are stored in the treatments table as `doctor_earnings`
- Visible in:
  - **Doctor Dashboard**: Monthly Commission & Weekly Commission cards
  - **Admin Dashboard**: Doctor Earnings (Commission) aggregated table
  - **Admin Dashboard**: Per-Treatment Commission Breakdown for individual records
  - **Records Tab**: Doctor Earned column per treatment

### Doctor Commission (Percentage-Based Earnings)
- `commission_percentage` on Doctor: 0-100%, set in the Doctor tab
- When a treatment is recorded, the system looks up the treating doctor's commission_percentage
- `doctorEarnings = treatment_cost x (commission_percentage / 100)`
- The calculated earnings are stored in the treatments table as `doctor_earnings`
- Visible in:
  - Doctor Dashboard: Monthly Commission & Weekly Commission cards
  - Admin Dashboard: Doctor Earnings (Commission) aggregated table
  - Admin Dashboard: Per-Treatment Commission Breakdown for individual records
  - Records Tab: Doctor Earned column per treatment

### Medicine Model
- `id`: Unique identifier
- `name`, `description`: Product information
- `stock`, `min_stock`: Inventory levels
- `price`: Unit price in MMK
- `category`: Classification (antibiotic, analgesic, etc.)
- `unit`: Measurement unit

## AI Interaction Patterns

### Ask Mode (Read-Only Analysis)
- Querying existing data
- Generating reports and analysis
- Providing clinical guidance
- Answering informational questions
- No data modifications allowed

### Agent Mode (Full CRUD Access)
- Creating new records (patients, appointments, etc.)
- Updating existing records
- Deleting records
- Processing payments
- Managing inventory
- Performing administrative tasks

### Command Structure
AI commands follow this JSON format:
```
{ "action": "action_code", "params": { "param1": "value1", "param2": "value2" } }
```

### Supported Commands

#### Patient Management
- `p_c(n, e, ph, age, patient_type, address, city, township, m, password, balance, location_id)`: Create patient using the current registration form fields (name, email, phone, age, patient type, branch/location, address, city, township, optional portal password, clinical fee/balance, and medical history)
- `p_u(id, data)`: Update patient profile fields including name, email, phone, age, address, city, township, patient_type, medicalHistory, balance, and loyalty_points
- `p_d(id)`: Delete patient
- `p_find(name)`: Find patient by name
- `pat_bal(pid)`: Get patient balance
- `pat_hist(pid)`: Get patient treatment history

#### Appointment Management
- `apt_c(p_id, dr_id, dt, t, ty, n)`: Create appointment
- `apt_u(id, data)`: Update appointment
- `apt_d(id)`: Delete appointment
- `apt_reschedule(id, dt, t)`: Reschedule appointment
- `apt_status(id, status)`: Update appointment status
- `apt_find_patient(name)`: Find appointments for patient

#### Treatment Records
- `tr_create(pid, teeth[], desc, cost, meds[])`: Record treatment
- `tr_undo(id, pid, cost)`: Undo treatment record
- `treatment_types_get()`: Get all treatment types
- `treatment_type_create(name, cost, category)`: Create treatment type

#### Financial Operations
- `fin_pay(pid, amt)`: Process payment
- `fin_report(period)`: Get financial report (daily/weekly/monthly)

#### Medicine/Inventory Management
- `m_c(n, d, u, p, s, ms, c)`: Create medicine
- `m_u(id, data)`: Update medicine
- `m_restock(id, qty)`: Restock medicine
- `m_sell(pid, mid, qty, tid)`: Sell medicine
- `inv_low()`: Get low stock report

#### Manager Email (Resend Delivery)
- `mgr_email_add(email, name, role, primary)`: Save manager/boss email and optionally mark as primary
- `mgr_email_list()`: List saved manager emails
- `mgr_email_remove(query)`: Remove by email, name, or role
- `mgr_email_send(to, subject, body)`: Send an email to the manager (uses sender settings in the Settings tab)

## API Actions & Endpoints

The system uses a service-oriented architecture with API endpoints managed through the `api` service object:

### Services Available
- `api.patients` - Patient management
- `api.appointments` - Appointment management  
- `api.treatments` - Treatment recording
- `api.doctors` - Doctor management
- `api.medicines` - Inventory management
- `api.finance` - Financial operations
- `api.loyalty` - Loyalty program management
- `api.expenses` - Expense tracking

### Common API Patterns
- `create(data)` - Create new records
- `update(id, data)` - Update existing records
- `delete(id)` - Delete records
- `getAll()` - Retrieve all records
- `getById(id)` - Retrieve specific record

## Technical Implementation

### Context Compression Strategy
The AI assistant uses a token-optimized context building strategy:
- **Ask Mode**: Compressed data focusing on essential information
- **Agent Mode**: Extended context with detailed data for operations
- **Complex Queries**: Enhanced context with analytical data

### Session Management
- LocalStorage-based session persistence
- Automatic cleanup of sessions older than 3 days
- Conversation continuity tracking
- Multi-turn conversation awareness

### Email Delivery (Resend + Supabase Edge)
- Settings tab stores sender name/email and delivery enabled flag
- Emails are delivered by a Supabase Edge Function that calls Resend
- Resend API key is stored as a Supabase secret (never in the frontend)
- Edge Function name: `send-manager-email` (set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` secrets)

### Assistant Memory (Supabase)
- Memory is stored in the `assistant_memory` table (per admin)
- Profiles are synced from the client and saved on each update
- Memory commands are routed with LLM-assisted classification, with a local fallback if the AI service is unavailable

### Response Processing
- Markdown-enhanced responses using ReactMarkdown and remark-gfm
- Internal processing artifact removal
- Chain of Thought reasoning (internal only)
- Action planning and execution

### Error Handling
- Graceful degradation from real API to mock responses
- Comprehensive error messaging
- Usage limit tracking
- API connection status monitoring

### Security Considerations
- Input validation for all AI-generated actions
- Role-based access controls
- Secure API key management
- Data sanitization for XSS prevention

## Clinical Decision Support

The AI assistant provides evidence-based clinical guidance including:
- Treatment protocol recommendations
- Medication interaction warnings
- Risk factor assessments
- Preventive care suggestions
- Referral recommendations
- Follow-up scheduling guidance

## Data Analysis Capabilities

The system provides analytical insights on:
- Patient demographics and trends
- Treatment volume and revenue analysis
- Inventory turnover and optimization
- Financial performance metrics
- Doctor workload distribution
- Appointment scheduling efficiency

## Integration Points

The AI assistant seamlessly integrates with all system modules:
- Real-time data access from all entities
- Transactional integrity for all operations
- Audit trail maintenance
- Notification systems
- Reporting engines
- Third-party service connections

This documentation provides the AI assistant with comprehensive understanding of the Dental Cloud application's workflows, enabling it to effectively assist users with both clinical and administrative tasks while maintaining system integrity and data consistency.
