# AI Assistant Proficiency Adaptation Guide

## Overview
The Dental Cloud AI Assistant (Loli) is designed to adapt its communication style based on the expected proficiency level of clinical staff. This ensures that responses are appropriate for nurses and other clinical personnel who may not have technical backgrounds.

## How the AI Adapts to Your Needs

### Language Adjustment
- **Simple Terms**: The AI uses everyday language instead of technical jargon
- **Clinical Focus**: Responses focus on patient care, treatments, and clinical workflows
- **No Programming Concepts**: The AI avoids technical terms like "function", "parameter", "API", "JSON", etc.

### Response Style
- **Clear Instructions**: Directions are straightforward and easy to follow
- **Practical Focus**: Information is presented in the context of actual clinical work
- **Relevant Examples**: Examples relate to dental practice scenarios

## What to Expect from AI Responses

### Before Adaptation
```
❌ "To create a receipt, you typically need to process a payment for a patient's services or outstanding balance. The system generates a record of this payment, which serves as the receipt.

Here's how it generally works:

1. Record the Treatment (if applicable): If the receipt is for a specific service rendered today, that treatment should be recorded first. For example:
   • tr_create(pid="patient_id", teeth=[18], desc="Composite Filling", cost=150)

2. Process the Payment: Once the service is recorded or if the patient is paying an outstanding balance, you use the fin_pay action. You will need the patient's ID (or name) and the amount they are paying.
   • fin_pay(pid="patient_id", amt=150)"
```

### After Adaptation
```
✅ "To create a patient receipt, you'll need to process their payment. Here's how:

1. If the patient just received treatment today, make sure that treatment is recorded first in the system
2. Process the payment for the service or outstanding balance
3. The system automatically creates a receipt record when you process the payment

For example, if John Smith just paid 15,000 MMK for a filling:
• Simply tell the AI: 'Process payment of 15000 MMK from John Smith'
• The AI will create the receipt and update his balance"
```

## Feedback-Driven Improvement

The AI learns from your feedback:
- **Thumbs Up (👍)**: Tells the AI to continue using this communication style
- **Thumbs Down (👎)**: Signals the AI to adjust its approach
- **Pattern Recognition**: Over time, the AI recognizes what types of responses you find most helpful

## Best Practices for Interacting with the AI

### When Asking Questions
- Use natural, conversational language
- Describe your clinical scenario in simple terms
- Be specific about what you're trying to accomplish

### Example Phrases
- ✅ "How do I record a payment from a patient?"
- ✅ "Show me today's appointments"
- ✅ "What should I do when a patient has an overdue balance?"
- ❌ "What's the function for creating appointments?"

### Giving Feedback
- Rate responses regularly to help the AI learn
- The AI will gradually adapt to your preferred communication style
- Over time, responses will become more tailored to your needs

## Clinical Workflow Focus

The AI understands and supports these common clinical workflows:
- Patient check-ins and appointments
- Treatment recordings and follow-ups
- Payment processing and receipts
- Inventory and supply management
- Patient history and records

## Technical Safeguards

The system ensures:
- No exposure of internal technical details
- Protection of sensitive system information
- Focus on practical, usable information
- Safe and secure operations

## Questions?
If you have questions about how the AI assistant adapts to your needs:
- Look for the Quick Help button in the AI assistant
- Refer to the main help guide
- Ask a team leader for assistance

Remember: The AI assistant is designed to be your supportive partner in clinical work, communicating in ways that make sense for your daily practice.