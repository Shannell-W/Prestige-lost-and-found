// The one place notifications are created. Each one is saved for the website and, if the student
// turned it on and the server is configured (alerts.js), also sent by email/SMS.
//
// Inside a transaction (db.withTransaction), the email/SMS goes out only after the commit.
const { queueAlert } = require("./alerts");

async function addNotification(conn, userId, message, { itemId = null, lostReportId = null } = {}) {
  await conn.query("INSERT INTO notifications (user_id, message, item_id, lost_report_id) VALUES (?, ?, ?, ?)", [
    userId,
    message,
    itemId,
    lostReportId,
  ]);
  const send = () => queueAlert(userId, message);
  if (Array.isArray(conn.afterCommit)) conn.afterCommit.push(send);
  else send();
}

module.exports = { addNotification };
