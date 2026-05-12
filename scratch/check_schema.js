const mssql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'w2019-sql',
    database: process.env.DB_NAME || 'GestionFormacion',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function checkColumns() {
    try {
        let pool = await mssql.connect(config);
        let result = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'FacturasProveedores_Vencimientos'");
        console.log('Columns in FacturasProveedores_Vencimientos:');
        console.log(result.recordset.map(r => r.COLUMN_NAME).join(', '));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkColumns();
