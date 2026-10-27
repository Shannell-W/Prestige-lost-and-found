# API_NEEDS.md

## Upstream and Downstream Partners

- **Upstream Partner (We Consume From):** Team 4 (Music & Event Discovery Platform)

- **Downstream Partner (We Provide To):** Team 6 (MoneyMentor Kenya)

---

## Downstream API Needs (APIs Team 5 Provides to Team 6)

1. **Team 6** needs to **read** **claimed item reward amounts** from **Team 5** in order to **auto-populate extra income into user savings goals and budget calculators**.

   - **Freshness:** Updated within 24 hours (low urgency).
   - **Volume:** Called once per dashboard load.
   - **Authentification** Public data, no authentication required.

2. **Team 6** needs to **read** **user claim statuses** from **Team 5** in order to **track financial recovery progress on lost personal property**.

   - **Freshness:** Near real-time.
   - **Volume:** Called per profile page load.
   - **Authentification** Requires user authentication.

3. **Team 6** needs to **read** **school portal lost item statistics** from **Team 5** in order to **display campus financial impact data to students**.

   - **Freshness:** Updated daily.
   - **Volume:** Called once per landing page load.
   - **Authentification** Public data, no authentication required.

4. **Team 6** needs to **read** **student information** from **Team 5** in order to **identify students using Money Mentor Kenya**.

   - **Freshness:** Updated when student information changes.
   - **Volume:**  Retrieved as required by Team 6.
   - **Authentification:**  Required.

---

## Upstream API Needs (APIs Team 5 Consumes from Team 4)

1. **Team 5** needs to **read** **upcoming venue and event listings** from **Team 4** in order to **allow users to tag specific event locations when reporting lost items**.

   - **Freshness:** Updated within the hour.
   - **Volume:** Called per item report form load.
   - **Auth:** Public data, no authentication required.

2. **Team 5** needs to **read** **venue contact information** from **Team 4** in order to **help students reach out directly to venue managers about missing belongings**.

   - **Freshness:** Static / low freshness need.
   - **Volume:** Called on-demand when a user views item details.
   - **Auth:** Public data, no authentication required.

3. **Team 5** needs to **read** **artist performance schedules** from **Team 4** in order to **filter reported lost items by event date and time**.

   - **Freshness:** Real-time / live schedule updates.
   - **Volume:** Called per search query.
   - **Auth:** Public data, no authentication required.

---

## Audit Gap Analysis

During our requirement discussions with Team 6:

- **Supported by Audit:** Team 6 requested access to claim statuses and item reward values. Our Part B Audit confirms that we store **Found item details** and **Ownership claims**, so this requirement is natively supported.

- **Identified Gap:** Team 6 inquired about executing direct monetary reward payouts through our API. Our Part B Audit confirms our application does not process digital transactions, payments, or wallet transfers. We flagged this as a gap; Team 6 can only read reward values as static numeric data.

---

## Reflection

Conducting these partner interviews highlighted how interconnected distinct domain applications can be when structured in an API chain. We initially assumed Team 6 (a financial literacy platform) would have minimal use for a lost and found system. However, discovering that lost item rewards and asset losses impact budget calculations showed us the importance of understanding downstream requirements directly rather than relying on assumptions. Additionally, coordinating with Team 4 showed how leveraging their venue/event data significantly enhances our item-reporting accuracy without requiring us to rebuild event-management features ourselves.