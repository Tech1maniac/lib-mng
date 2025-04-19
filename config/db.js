require("dotenv").config();
const oracledb = require("oracledb");

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
  poolMin: Number(process.env.POOL_MIN) || 1,
  poolMax: Number(process.env.POOL_MAX) || 10,
  poolIncrement: Number(process.env.POOL_INCREMENT) || 2,
};

const initPool = async () => {
  try {
    await oracledb.createPool(dbConfig);
    console.log("Oracle DB connection pool started");
  } catch (err) {
    console.error("Error creating Oracle DB connection pool", err);
    process.exit(1);
  }
};

module.exports = { oracledb, initPool };
