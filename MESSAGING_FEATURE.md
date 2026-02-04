# Real-time Messaging Feature

## Overview
This feature enables real-time bidirectional communication between patients and clinic administrators through a dedicated messaging system using Supabase database with automatic cleanup.

## Database Setup

1. Run the SQL script to create messaging tables:
```sql
-- Execute the messaging_tables.sql file in your Supabase SQL editor
\i database/messaging_tables.sql
```

This will create:
- `conversations` table - tracks patient-admin conversations
- `messages` table - stores individual messages
- RLS policies for secure access
- Indexes for performance optimization
- Triggers for automatic timestamp updates
- Cleanup function (used by application code)

## Automatic Cleanup System

- **Cleanup Policy**: Messages older than 2 months are automatically deleted
- **Conversation Cleanup**: Empty conversations older than 2 months are also removed
- **Performance**: Maintains system performance by preventing data bloat
- **Patient Notification**: Clear warning displayed to patients about automatic deletion
- **Implementation**: Built-in application-level cleanup (no external scheduled jobs required)
- **Frequency**: Cleanup runs automatically when users access messaging features
- **Efficiency**: Smart throttling - cleanup runs at most once per 24 hours

## Features Implemented

### Admin Dashboard
- **Messaging Tab**: Added to admin navigation sidebar
- **Conversation Management**: View all patient conversations
- **Real-time Updates**: Messages appear instantly without page refresh
- **Unread Indicators**: Visual indicators for unread messages
- **Message Status**: Read/unread status tracking

### Patient Dashboard
- **Messages Tab**: Added to patient navigation
- **Contact Admin**: Start conversations with clinic staff
- **Real-time Chat**: Instant message delivery
- **Conversation History**: View past conversations
- **Unread Counters**: Track unread messages
- **Automatic Cleanup Warning**: Clear notification about message retention policy

### Technical Features
- **Supabase Integration**: Uses Supabase real-time subscriptions
- **Efficient Loading**: Only loads relevant conversations and messages
- **Secure Access**: Row-level security policies ensure data privacy
- **Performance Optimized**: Proper indexing and query optimization
- **Mobile Responsive**: Works well on all device sizes
- **Automatic Cleanup**: Built-in data retention management

## Usage

### For Administrators
1. Navigate to the "Messaging" tab in the admin dashboard
2. View all patient conversations in the sidebar
3. Click on any conversation to view messages
4. Send replies using the message input at the bottom
5. Unread messages are automatically marked as read when viewed

### For Patients
1. Navigate to the "Messages" tab in the patient dashboard
2. If no conversation exists, click "Start Chat" to create one
3. View existing conversations or start new ones
4. Send messages to clinic staff
5. Receive real-time responses from administrators
6. **Note**: Messages older than 2 months will be automatically deleted

## Security
- All messages are associated with authenticated users
- Patients can only see their own conversations
- Admins can only see conversations they're part of
- Row-level security policies enforce access control
- Messages are stored securely in Supabase database

## Performance
- Optimized database queries with proper indexing
- Efficient real-time subscriptions
- Automatic cleanup prevents data bloat
- Smooth performance even on slower connections
- Scalable for growing user base

## Data Management
- **Storage Location**: Supabase PostgreSQL database
- **Data Persistence**: Until automatic cleanup (2 months)
- **Cleanup Mechanism**: Application-level automatic cleanup
- **Cleanup Trigger**: Runs when users access messaging features
- **Throttling**: Maximum once per 24 hours per user session
- **Data Retention**: 2 months for all messages
- **Conversation Cleanup**: Empty conversations older than 2 months

## Future Enhancements
- Message attachments
- Group conversations
- Message search functionality
- Notification system
- Message templates
- Typing indicators
- Export conversation history
- Customizable retention periods
- Message archiving options