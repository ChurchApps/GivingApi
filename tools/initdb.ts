import "reflect-metadata";
import dotenv from "dotenv";
import { Environment } from "../src/helpers/Environment";
import { Pool, DBCreator } from "@churchapps/apihelper";

const init = async () => {
  dotenv.config();
  await Environment.init(process.env.APP_ENV);
  console.log("Connecting");
  Pool.initPool();

  const givingTables: { title: string, file: string }[] = [
    { title: "Funds", file: "funds.mysql" },
    { title: "Donations", file: "donations.mysql" },
    { title: "Fund Donations", file: "fundDonations.mysql" },
    { title: "Donation Batches", file: "donationBatches.mysql" },
    { title: "Gateways", file: "gateways.mysql" },
    { title: "Customers", file: "customers.mysql" },
    { title: "Event Logs", file: "eventLogs.mysql" },
    { title: "Settings", file: "settings.mysql" },
    { title: "Subscriptions", file: "subscriptions.mysql" },
    { title: "Subscription Funds", file: "subscriptionFunds.mysql" }
  ];

  await initTables("Giving", givingTables);
}

const initTables = async (displayName: string, tables: { title: string, file: string }[]) => {
  console.log("");
  console.log("SECTION: " + displayName);
  for (const table of tables) await DBCreator.runScript(table.title, "./tools/dbScripts/" + table.file, false);
}

init()
  .then(() => { console.log("Database Created"); process.exit(0); })
  .catch((ex) => {
    console.log(ex);
    console.log("Database not created due to errors");
    process.exit(0);
  });

