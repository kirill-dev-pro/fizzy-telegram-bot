// test-tg.js
import https from "https";

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  console.error("BOT_TOKEN environment variable is not set");
  process.exit(1);
}

https
  .get(`https://api.telegram.org/bot${botToken}/getMe`, (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => {
      console.log("STATUS", res.statusCode);
      console.log("BODY", data);
    });
  })
  .on("error", (e) => {
    console.error("ERROR", e);
  });
