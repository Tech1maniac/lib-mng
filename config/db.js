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

// 🔥 Add this:
const execute = async (query, params = {}, options = {}) => {
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(query, params, {
      ...options,
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return result;
  } catch (err) {
    console.error("DB execution error:", err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing connection:", err);
      }
    }
  }
};

module.exports = { oracledb, initPool, execute };
