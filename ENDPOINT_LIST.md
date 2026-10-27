# ENDPOINT_LIST.md

## Downstream API Endpoints (Team 5 Provides to Team 6)

| Method | Path | Purpose | Maps to Need |
|--------|------|---------|--------------|
| GET | `/claims?status=claimed` | Return claimed items with their reward amounts | Team 6 needs to read claimed item reward amounts from Team 5 in order to auto-populate extra income into user savings goals and budget calculators. |
| GET | `/students/{studentId}/claims` | Return a student's claims with current status | Team 6 needs to read user claim statuses from Team 5 in order to track financial recovery progress on lost personal property. |
| GET | `/schools/{schoolId}/item-statistics` | Return aggregate lost-item statistics for a school | Team 6 needs to read school portal lost item statistics from Team 5 in order to display campus financial impact data to students. |
| GET | `/claims/{claimId}/fees` | Return fee details (claim ID, student ID, item ID, amount payable) for a claim | Finance application needs the claim ID, student ID, item ID, and amount payable for claim/recovery fees. |
| GET | `/claims/{claimId}/refunds` | Return refund details (claim, student, amount, reason) for a claim, supporting one or more refund events (e.g. partial refunds) | Finance application needs information about the claim, student, amount, and reason for the refund. |
