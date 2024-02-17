import * as fs from 'fs';
import { pipeline } from 'stream/promises';
import * as mysql from 'mysql2';
import * as mssql from 'tedious';
import * as postgres from 'pg';
//import * as db2 from 'ibm_db';
import { from as pgLoadInto } from 'pg-copy-streams';
import * as adls from '@azure/storage-file-datalake';
import { logger } from './logger.js';
import { connectionConfig, queryResult, tableConfigYAML, databaseFieldInfo, cdmModel, cdmEntity, cdmPartition, cdmAttribute, cdmFileFormatSetting } from './definition.js';

const maxQuerySize = 50000;

class _database {

    config: connectionConfig;

    constructor() {
        try {
            this.config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))['database'];
        } catch (err) {
            this.config = {
                technology: 'mssql',
                server: 'localhost',
                schema: 'tallydb',
                username: 'sa',
                password: 'admin',
                port: 1433,
                ssl: false,
                loadmethod: 'insert'
            };
            logger.logError('database()', err);
            throw err;
        }
    }

    updateCommandlineConfig(lstConfigs: Map<string, string>): void {
        try {
            if (lstConfigs.has('database-technology')) this.config.technology = lstConfigs.get('database-technology') || '';
            if (lstConfigs.has('database-server')) this.config.server = lstConfigs.get('database-server') || '';
            if (lstConfigs.has('database-port')) this.config.port = parseInt(lstConfigs.get('database-port') || '0');
            if (lstConfigs.has('database-schema')) this.config.schema = lstConfigs.get('database-schema') || '';
            if (lstConfigs.has('database-username')) this.config.username = lstConfigs.get('database-username') || '';
            if (lstConfigs.has('database-password')) this.config.password = lstConfigs.get('database-password') || '';
            if (lstConfigs.has('database-ssl')) this.config.ssl = lstConfigs.get('database-ssl') == 'true';

        } catch (err) {
            logger.logError('database.updateCommandlineConfig()', err);
            throw err;
        }

    }

    convertCSV(content: string, lstFieldType: string[], doubleQuote: boolean = false): string {
        let lstLines = content.split(/\r\n/g);
        for (let r = 0; r < lstLines.length; r++) {
            let line = lstLines[r];
            line = line.replace(/ñ/g, ''); //replace blank date with empty text
            line = line.replace(/\"/g, '""'); //escape double quotes with 2 instance of double quotes (as per ISO)
            let lstValues = line.split('\t');
            for (let c = 0; c < lstValues.length; c++) {
                let targetFieldType = lstFieldType[c];
                let targetFieldValue = lstValues[c];
                if (doubleQuote)
                    lstValues[c] = `"${targetFieldValue}"`;
                else
                    if (targetFieldType == 'text' || targetFieldType == 'date')
                        lstValues[c] = `"${targetFieldValue}"`;
            }
            lstLines[r] = lstValues.join(',');
        }
        return lstLines.join('\r\n');
    }

    csvToJsonArray(content: string, targetTable: string, lstFieldType: string[]): any[] {
        let retval: any[] = [];
        try {
            let lstLines = content.split(/\r\n/g);
            let fieldList = lstLines.shift() || ''; //extract header
            let lstFields = fieldList.split(/\t/g);
            for (const line of lstLines) {
                if (line == '') continue;
                let objRow = {};
                let lstValues = line.split(/\t/g);
                for (let f = 0; f < lstFields.length; f++) {
                    const fieldName = lstFields[f];
                    const fieldType = lstFieldType[f];
                    let fieldRawValue = lstValues[f];
                    let fieldValue = undefined;
                    if (fieldRawValue == 'ñ') { //NULL
                        fieldValue = null;
                    }
                    else if (fieldType == 'text') { //Text
                        fieldValue = fieldRawValue;
                    }
                    else if (fieldType == 'number' || fieldType == 'logical' || fieldType == 'amount' || fieldType == 'quantity' || fieldType == 'rate' ) { //Numeric
                        fieldValue = parseFloat(fieldRawValue);
                        if (isNaN(fieldValue)) {
                            fieldValue = null;
                        }
                    }
                    else if (fieldType == 'date') {
                        fieldValue = fieldRawValue == '' ? null : new Date(fieldRawValue);
                    }
                    Object.defineProperty(objRow, fieldName.trim(), { enumerable: true,  value: fieldValue });
                }
                retval.push(objRow);
            }
        } catch (err) {
            logger.logError('database.executeDb2()', err);
        }
        return retval;
    }

    bulkLoad(csvFile: string, targetTable: string, lstFieldType: string[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            let sqlQuery = '';
            try {
                sqlQuery = '';
                let rowCount = 0;

                if (this.config.loadmethod == 'insert') { //INSERT query based loading
                    let txtCSV = fs.readFileSync(csvFile, 'utf-8');
                    let lstLines = txtCSV.split(/\r\n/g);
                    let fieldList = lstLines.shift() || ''; //extract header
                    fieldList = fieldList.replace(/\t/g, ','); //replace tab with comma for header

                    while (lstLines.length) { //loop until row is found
                        sqlQuery = `insert into ${targetTable} (${fieldList}) values`;

                        let countBatch = 0; //number of rows in batch

                        //run a loop to keep on appending row to SQL Query values until max allowable size of query is exhausted
                        while (lstLines.length && (sqlQuery.length + lstLines[0].length + 3 < maxQuerySize) && ++countBatch <= 1000) {
                            let activeLine = lstLines.shift() || '';
                            let lstValues = activeLine.split('\t');
                            for (let i = 0; i < lstValues.length; i++) {
                                let targetFieldType = lstFieldType[i];
                                let targetFieldValue = lstValues[i];
                                if (targetFieldType == 'text') {
                                    let hasUnicodeText = /[^\u0000-\u007f]/g.test(targetFieldValue);
                                    targetFieldValue = targetFieldValue.replace(/'/g, '\'\'');  //escape single quote
                                    if (this.config.technology == 'mysql')
                                        targetFieldValue = targetFieldValue.replace(/\\/g, '\\\\'); //MySQL requires escaping of backslash
                                    targetFieldValue = `'${targetFieldValue}'`; //enclose value in single quotes for SQL query
                                    if (hasUnicodeText && this.config.technology == 'mssql')
                                        targetFieldValue = 'N' + targetFieldValue; //SQL Server requires prefixing quoted text with N if any Unicode character exists in string
                                    lstValues[i] = targetFieldValue;
                                }
                                else if (targetFieldType == 'date') {
                                    lstValues[i] = targetFieldValue == 'ñ' ? 'NULL' : `'${targetFieldValue}'`;
                                }
                                else;
                            }
                            activeLine = lstValues.join(','); //prepare SQL statement with values separated by comma
                            sqlQuery += `(${activeLine}),`; //enclose row values into round braces
                        }

                        sqlQuery = sqlQuery.substr(0, sqlQuery.length - 1) + ';'; //remove last trailing comma and append colon
                        rowCount += await this.executeNonQuery(sqlQuery);
                    }
                }
                else { //File based loading

                    //modify file to handle null values for date field
                    if (this.config.technology == 'postgres') {
                        let fileContent = fs.readFileSync(csvFile, 'utf-8');
                        fileContent = fileContent.replace(/ñ/g, 'ø'); //substitute NULL with placeholder
                        fileContent = this.convertCSV(fileContent, lstFieldType);
                        fileContent = fileContent.replace(/\"ø\"/g, ''); //replace placeholder with nothing along with enclosing double quotes
                        fs.writeFileSync(csvFile, '\ufeff' + fileContent);
                    }
                    else if (this.config.technology == 'mysql') {
                        let fileContent = fs.readFileSync(csvFile, 'utf-8');
                        fileContent = fileContent.replace(/ñ/g, 'ø'); //substitute NULL with placeholder
                        fileContent = this.convertCSV(fileContent, lstFieldType, true);
                        fileContent = fileContent.replace(/\"ø\"/g, 'NULL'); //replace placeholder with nothing along with enclosing double quotes
                        fs.writeFileSync(csvFile, '\ufeff' + fileContent); //write desired changes to file
                    }
                    else if (this.config.technology == 'mssql') { //SQL Server
                        let fileContent = fs.readFileSync(csvFile, 'utf-8');
                        fileContent = fileContent.replace(/ñ/g, ''); //substitute NULL with placeholder
                        fileContent = fileContent.replace(/\"/g, '""'); //escape double quotes
                        fs.writeFileSync(csvFile, '\ufeff' + fileContent + '\r\n'); //write desired changes to file
                    }
                    else;

                    if (this.config.technology == 'mysql') {
                        // sqlQuery = `load data infile '${csvFile.replace(/\\/g, '\\\\')}' into table ${targetTable} fields terminated by ',' enclosed by '"' escaped by '' lines terminated by '\r\n' ignore 1 lines ;`;
                        // rowCount = await this.executeNonQuery(sqlQuery);
                        rowCount = await this.dumpDataMysql(targetTable, lstFieldType);
                    }
                    else if (this.config.technology == 'mssql') {
                        //sqlQuery = `bulk insert ${targetTable} from '${csvFile}' with ( firstrow = 2, codepage = '65001')`;
                        //rowCount = await this.executeNonQuery(sqlQuery);
                        rowCount = await this.dumpDataMssql(targetTable, lstFieldType);
                    }
                    else if (this.config.technology == 'postgres') {
                        //sqlQuery = `copy ${targetTable} from '${csvFile}' csv header;`;
                        //rowCount = await this.executeNonQuery(sqlQuery);
                        await this.dumpDataPostges(targetTable);
                    }
                    else;
                }
                resolve(rowCount);
            } catch (err: any) {
                reject(err);
                if (typeof err == 'object')
                    err['targetQuery'] = sqlQuery;
                logger.logError('database.bulkLoad()', err);
            }
        });
    }

    executeNonQuery(sqlQuery: string | string[], values?: Map<string, any>): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            try {
                let retval = 0;
                if (this.config.technology.toLowerCase() == 'mysql') {
                    retval = (await this.executeMysql(sqlQuery)).rowCount;
                }
                else if (this.config.technology.toLowerCase() == 'mssql') {
                    retval = (await this.executeMssql(sqlQuery)).rowCount;
                }
                else if (this.config.technology.toLowerCase() == 'postgres') {
                    retval = (await this.executePostgres(sqlQuery)).rowCount;
                }
                /*else if (this.config.technology.toLowerCase() == 'db2') {
                    retval = (await this.executeDb2(sqlQuery)).rowCount;
                }*/
                else;
                resolve(retval);
            } catch (err) {
                reject(err);
            }
        });
    }

    executeScalar<T>(sqlQuery: string): Promise<T> {
        return new Promise<T>(async (resolve, reject) => {
            try {
                let retval = undefined;
                if (this.config.technology.toLowerCase() == 'mysql') {
                    let result = await this.executeMysql(sqlQuery);
                    if (Array.isArray(result.data) && result.data.length == 1) {
                        let lstProps = Object.keys(result.data[0]);
                        retval = result.data[0][lstProps[0]];
                    }
                }
                else if (this.config.technology.toLowerCase() == 'mssql') {
                    let result = await this.executeMssql(sqlQuery);
                    if (Array.isArray(result.data) && result.data.length == 1)
                        retval = result.data[0][0].value;
                }
                else if (this.config.technology.toLowerCase() == 'postgres') {
                    let result = await this.executePostgres(sqlQuery);
                    if (Array.isArray(result.data) && result.data.length == 1)
                        retval = result.data[0][0];
                }
                else;

                resolve(retval);
            } catch (err) {
                reject(err);
            }
        });
    }

    truncateTables(lstTables: string[]): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let lstTruncateSQL: string[] = [];
                for (let i = 0; i < lstTables.length; i++) {
                    let sqlQuery = `truncate table ${lstTables[i]}`;
                    /*if (this.config.technology == 'db2') {
                        sqlQuery += ' immediate';
                    }*/
                    sqlQuery += ';';
                    lstTruncateSQL.push(sqlQuery);
                }
                await this.executeNonQuery(lstTruncateSQL); //fire all truncate table SQL queries in one go
                resolve();
            } catch (err) {
                reject(err);
                logger.logError('database.truncateTables()', err);
            }
        });
    }

    uploadAzureDataLake(lstTables: tableConfigYAML[]): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                //extract connection string and domain from ADLS config file
                let connectionString = '', domain = '';
                connectionString = this.config.server;
                let regDomain = /AccountName=([\w_-]+);/g.exec(connectionString);
                if (regDomain)
                    domain = regDomain[1];

                //generate model.json
                let objCdmModel: cdmModel = {
                    name: this.config.schema,
                    version: '1.0.0',
                    entities: []
                };
                
                for(const targetTable of lstTables) {
                    let objEntity: cdmEntity = {
                        $type: 'LocalEntity',
                        name: targetTable.name,
                        attributes: [],
                        partitions: [
                            {
                                name: targetTable.name,
                                location: `https://${domain}.dfs.core.windows.net/tally/${this.config.schema}/${targetTable.name}.csv`,
                                fileFormatSettings: {
                                    $type: 'CsvFormatSettings',
                                    columnHeaders: true
                                }
                            }
                        ]
                    };
                    for(const targetField of targetTable.fields) {
                        let cdmDataType = '';
                        if(targetField.type == 'text') {
                            cdmDataType = 'string';
                        }
                        else if(targetField.type == 'number' || targetField.type == 'logical') {
                            cdmDataType = 'Int64';
                        }
                        else if(targetField.type == 'amount') {
                            cdmDataType = 'decimal';
                        }
                        else if(targetField.type == 'date') {
                            cdmDataType = 'date';
                        }
                        else { //fallback
                            cdmDataType = 'text';
                        }
                        objEntity.attributes.push({
                            name: targetField.name,
                            dataType: cdmDataType
                        });
                    }
                    objCdmModel.entities.push(objEntity);
                }
                let contentModel = JSON.stringify(objCdmModel);

                //create tally container if not exists
                const datalakeServiceClient = adls.DataLakeServiceClient.fromConnectionString(connectionString);
                const fileSystemClient = datalakeServiceClient.getFileSystemClient('tally');
                await fileSystemClient.createIfNotExists();

                //create delete and re-create company directory
                const directoryClient = fileSystemClient.getDirectoryClient(this.config.schema);
                await directoryClient.deleteIfExists(true);

                //write model.json
                const fileClientModel = directoryClient.getFileClient('model.json');
                await fileClientModel.create();
                await fileClientModel.append(contentModel, 0, contentModel.length);
                await fileClientModel.flush(contentModel.length);

                //iterate through each csv file & write it
                for (const targetTable of lstTables) {
                    let contentCSV = fs.readFileSync(`./csv/${targetTable.name}.csv`);
                    const fileClientCSV = directoryClient.getFileClient(`${targetTable.name}.csv`);
                    await fileClientCSV.create();
                    await fileClientCSV.append(contentCSV, 0, contentCSV.byteLength);
                    await fileClientCSV.flush(contentCSV.byteLength);
                    logger.logMessage('  %s: uploaded', targetTable.name);
                }
                resolve();

            } catch (err) {
                reject();
                logger.logError('database.uploadAzureDataLake()', err);
            }
        });
    }

    private executeMysql(sqlQuery: string | string[]): Promise<queryResult> {
        return new Promise<queryResult>((resolve, reject) => {
            try {
                let connection = mysql.createConnection({
                    host: this.config.server,
                    port: this.config.port,
                    database: this.config.schema,
                    user: this.config.username,
                    password: this.config.password,
                    ssl: !this.config.ssl ? undefined : {
                        rejectUnauthorized: false
                    }
                });
                connection.connect(async (connErr) => {
                    if (connErr) {
                        let errorMessage = '';
                        if (connErr.code == 'ECONNREFUSED') errorMessage = 'Unable to make MySQL connection on specified port';
                        else if (connErr.code == 'ENOTFOUND') errorMessage = 'Unable to make MySQL connection to servername or IP address';
                        else if (connErr.code == 'ER_BAD_DB_ERROR') errorMessage = 'Invalid MySQL database name';
                        else if (connErr.code == 'ER_ACCESS_DENIED_ERROR') errorMessage = 'Invalid MySQL password';
                        else if (connErr.code == 'ER_NOT_SUPPORTED_AUTH_MODE') errorMessage = 'Invalid MySQL username/password/Authentication';
                        else;

                        logger.logError('database.executeMysql()', errorMessage || connErr);
                        reject('');
                    }
                    else {
                        const executeQuery = (qry: string): Promise<queryResult> => {
                            return new Promise<queryResult>((_resolve, _reject) => {
                                connection.query(qry, (queryErr, results: any[] | any) => {
                                    if (queryErr) {
                                        _reject(queryErr);
                                    }
                                    else
                                        _resolve({ rowCount: results['affectedRows'] || 0, data: results });
                                });
                            });
                        }
                        let rowCount = 0;
                        let data: any[] = [];
                        if(Array.isArray(sqlQuery)) { //multiple query
                            for(const qry of sqlQuery) {
                                await executeQuery(qry);
                            }
                        }
                        else { //single query
                            let result = await executeQuery(sqlQuery);
                            rowCount = result.rowCount;
                            data = result.data;
                        }
                        connection.end();
                        resolve({ rowCount, data });
                    }
                });
            } catch (err) {
                reject(err);
                logger.logError('database.executeMysql()', err);
            }
        });
    }

    private executeMssql(sqlQuery: string | string[]): Promise<queryResult> {
        return new Promise<queryResult>((resolve, reject) => {
            try {
                let connection = new mssql.Connection({
                    server: this.config.server,
                    authentication: {
                        options: {
                            userName: this.config.username,
                            password: this.config.password
                        },
                        type: 'default'
                    },
                    options: {
                        database: this.config.schema,
                        port: this.config.port,
                        trustServerCertificate: true,
                        encrypt: this.config.ssl,
                        rowCollectionOnRequestCompletion: true
                    }
                });
                connection.on('connect', async (connErr) => {
                    if (connErr) {
                        let errorMessage = '';
                        if (connErr.message.includes('getaddrinfo ENOTFOUND')) errorMessage = 'Unable to make SQL Server connection to specified servername or IP address';
                        else if (connErr.message.includes('Could not connect (sequence)')) errorMessage = 'Unable to make SQL Server connection to specified port';
                        else if (connErr.message.includes('Login failed for user')) errorMessage = 'Invalid Database / Username / Password';
                        else;

                        logger.logError('database.executeMssql()', errorMessage || connErr);
                        reject(connErr);
                    }
                    else {
                        const executeQuery = (qry: string): Promise<queryResult> => {
                            return new Promise<queryResult>((_resolve,_reject) => {
                                connection.execSql(new mssql.Request(qry, (queryErr, rowCount, rows) => {
                                    if (queryErr)
                                        _reject(queryErr);
                                    else
                                        _resolve({ rowCount, data: rows });
                                }));
                            });
                        };
                        let rowCount = 0;
                        let data: any[] = [];
                        if(Array.isArray(sqlQuery)) { //multiple query
                            for(const qry of sqlQuery) {
                                await executeQuery(qry);
                            }
                        }
                        else { //single query
                            let result = await executeQuery(sqlQuery);
                            rowCount = result.rowCount;
                            data = result.data || [];
                        }
                        connection.close();
                        resolve({ rowCount, data });
                    }
                        
                });
                connection.connect();
            } catch (err) {
                reject(err);
                logger.logError('database.executeMssql()', err);
            }
        });
    }

    private executePostgres(sqlQuery: string | string[]): Promise<queryResult> {
        return new Promise<queryResult>(async (resolve, reject) => {
            try {
                let connection = new postgres.Client({
                    host: this.config.server,
                    port: this.config.port,
                    database: this.config.schema,
                    user: this.config.username,
                    password: this.config.password,
                    ssl: !this.config.ssl ? false : {
                        rejectUnauthorized: false
                    },
                });
                await connection.connect();
                let rowCount = 0;
                let data: any[] = [];
                if(Array.isArray(sqlQuery)) { //multiple query
                    for(const qry of sqlQuery) {
                        await connection.query(qry);
                    }
                }
                else { //single query
                    let qryConfig: postgres.QueryArrayConfig = {
                        rowMode: 'array',
                        text: sqlQuery
                    };
                    let result = await connection.query(qryConfig);
                    rowCount = result.rowCount || 0;
                    data = result.rows;
                }
                await connection.end();
                resolve({ rowCount, data });
            } catch (err: any) {
                let errorMessage = '';
                let errSystemMessage = typeof err['message'] == 'string' ? err['message'] : '';
                if (errSystemMessage.startsWith('getaddrinfo ENOTFOUND')) errorMessage = 'Unable to make PostgreSQL connection to servername or IP address';
                else if (errSystemMessage.startsWith('connect ECONNREFUSED')) errorMessage = 'Unable to make PostgreSQL connection on specified port';
                else if (errSystemMessage.startsWith('database') && errSystemMessage.endsWith('does not exist')) errorMessage = 'Invalid PostgreSQL database';
                else if (errSystemMessage.startsWith('password authentication failed for user')) errorMessage = 'Invalid PostgreSQL username or password';
                else if (errSystemMessage == 'The server does not support SSL connections') errorMessage = 'Specified PostgreSQL Database Server does not support secure connection';
                else;
                reject(err);
                logger.logError('database.executePostgres()', errorMessage || err);
            }
        });
    }

    

    private dumpDataPostges(targetTable: string): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            try {
                const sourceStream = fs.createReadStream(`./csv/${targetTable}.data`, 'utf-8');
                let connection = new postgres.Client({
                    host: this.config.server,
                    port: this.config.port,
                    database: this.config.schema,
                    user: this.config.username,
                    password: this.config.password,
                    ssl: !this.config.ssl ? false : {
                        rejectUnauthorized: false
                    },
                });
                await connection.connect();
                let ptrCopyQueryStream = pgLoadInto(`copy ${targetTable} from stdin csv header;`);
                const targetStream = connection.query(ptrCopyQueryStream);
                await pipeline(sourceStream, targetStream);
                await connection.end();
                resolve(ptrCopyQueryStream.rowCount || 0);
            } catch (err) {
                reject(err);
                logger.logError('database.dumpDataPostges()', err);
            }
        });
    }

    private dumpDataMysql(targetTable: string, lstFieldType: string[]): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            try {
                let connection = mysql.createConnection({
                    host: this.config.server,
                    port: this.config.port,
                    database: this.config.schema,
                    user: this.config.username,
                    password: this.config.password,
                    ssl: !this.config.ssl ? undefined : {
                        rejectUnauthorized: false
                    },
                    infileStreamFactory: p => fs.createReadStream(p)
                });
                connection.connect(async (connErr) => {
                    if (connErr) {
                        let errorMessage = '';
                        if (connErr.code == 'ECONNREFUSED') errorMessage = 'Unable to make MySQL connection on specified port';
                        else if (connErr.code == 'ENOTFOUND') errorMessage = 'Unable to make MySQL connection to servername or IP address';
                        else if (connErr.code == 'ER_BAD_DB_ERROR') errorMessage = 'Invalid MySQL database name';
                        else if (connErr.code == 'ER_ACCESS_DENIED_ERROR') errorMessage = 'Invalid MySQL password';
                        else if (connErr.code == 'ER_NOT_SUPPORTED_AUTH_MODE') errorMessage = 'Invalid MySQL username/password/Authentication';
                        else;

                        logger.logError('database.executeMysql()', errorMessage || connErr);
                        reject('');
                    }
                    else {
                        let sqlQuery = `load data local infile './csv/${targetTable}.data' into table ${targetTable} fields terminated by ',' enclosed by '"' escaped by '' lines terminated by '\r\n' ignore 1 lines ;`;
                        connection.query(sqlQuery, (queryErr, results: any[] | any) => {
                            connection.end();
                            if (queryErr) {
                                reject(queryErr);
                            }
                            else {
                                resolve(results['affectedRows'] || 0);
                            }
                        });
                    }
                });
            } catch (err) {
                reject(err);
                logger.logError('database.dumpDataMysql()', err);
            }
        });
    }

    private dumpDataMssql(targetTable: string, lstFieldType: string[]): Promise<number> {
        return new Promise<number>(async (resolve, reject) => {
            try {
                let content = fs.readFileSync(`./csv/${targetTable}.data`, 'utf-8');
                let lstData = this.csvToJsonArray(content, targetTable, lstFieldType);
                if(!lstData.length) { //skip bulk insert if no rows are found
                    return resolve(0);
                }
                let lstColumnInfo = this.populateDatabaseTableInfo(targetTable);
                let connection = new mssql.Connection({
                    server: this.config.server,
                    authentication: {
                        options: {
                            userName: this.config.username,
                            password: this.config.password
                        },
                        type: 'default'
                    },
                    options: {
                        database: this.config.schema,
                        port: this.config.port,
                        trustServerCertificate: true,
                        encrypt: this.config.ssl,
                        rowCollectionOnRequestCompletion: true
                    }
                });
                connection.on('connect', (connErr) => {
                    if (connErr) {
                        let errorMessage = '';
                        if (connErr.message.includes('getaddrinfo ENOTFOUND')) errorMessage = 'Unable to make SQL Server connection to specified servername or IP address';
                        else if (connErr.message.includes('Could not connect (sequence)')) errorMessage = 'Unable to make SQL Server connection to specified port';
                        else if (connErr.message.includes('Login failed for user')) errorMessage = 'Invalid Database / Username / Password';
                        else;

                        logger.logError('database.executeMssql()', errorMessage || connErr);
                        reject(connErr);
                    }
                    else {
                        const blOptions = { keepNulls: true };
                        const oBulkLoad = connection.newBulkLoad(targetTable, blOptions, function (err, rowCount) {
                            connection.close();
                            if(err) {
                                return reject(err);
                            }
                            else {
                                resolve(rowCount);
                            }
                        });
                        
                        for(const col of lstColumnInfo) {
                            let oColOpts: mssql.BulkLoadColumnOpts = {
                                nullable: col.isNullable
                            };
                            
                            //set datatype
                            let oColDataType: mssql.TediousType;
                            if(col.dataType == 'varchar') oColDataType = mssql.TYPES.VarChar;
                            else if(col.dataType == 'nvarchar') oColDataType = mssql.TYPES.NVarChar;
                            else if(col.dataType == 'int') oColDataType = mssql.TYPES.Int;
                            else if(col.dataType == 'tinyint') oColDataType = mssql.TYPES.TinyInt;
                            else if(col.dataType == 'decimal') oColDataType = mssql.TYPES.Decimal;
                            else if(col.dataType == 'date') oColDataType = mssql.TYPES.Date;
                            else oColDataType = mssql.TYPES.NVarChar;

                            //set string length for textual datatype
                            if(col.length) {
                                oColOpts.length = col.length;
                            }

                            //set precision for decimal datatype
                            if(col.dataType == 'decimal') {
                                oColOpts.precision = col.precision;
                                oColOpts.scale = col.scale;
                            }

                            oBulkLoad.addColumn(col.fieldName, oColDataType, oColOpts);
                        }
                        connection.execBulkLoad(oBulkLoad, lstData);
                    }
                });
                connection.connect();
            } catch (err) {
                reject(err);
                logger.logError('database.dumpDataMssql()', err);
            }
        });
    }

    

    private populateDatabaseTableInfo(targetTable: string): databaseFieldInfo[] {
        let retval: databaseFieldInfo[] = [];
        try {
            let flgStart = false;
            let contentDatabaseStructure = fs.readFileSync('./database-structure.sql', 'utf-8');
            let lstLines = contentDatabaseStructure.split(/\r\n/g) || [];
            for (let i = lstLines.length - 1; i >= 0; i--) {
                if (lstLines[i] == '(' || lstLines[i] == ');') {
                    lstLines.splice(i, 1);
                }
            }
            for (const line of lstLines) {
                if (!flgStart) {
                    if (line == `create table ${targetTable}`) {
                        flgStart = true;
                    }
                }
                else {
                    if (line == '') { // end of table info
                        break;
                    }
                    else {
                        let isNullable = !line.includes('not null');
                        let lstParts = line.trim().match(/([a-z0-9_]+)/g);
                        let fieldName = lstParts ? lstParts[0] : '';
                        let dataType = lstParts ? lstParts[1] : ''
                        let fieldLength = lstParts && dataType.includes('char') ? parseInt(lstParts[2]) : 0;
                        let fieldPrecision = lstParts && dataType == 'decimal' ? parseInt(lstParts[2]): 0;
                        let fieldScale = lstParts && dataType == 'decimal' ? parseInt(lstParts[3]): 0;
                        let itemFieldInfo: databaseFieldInfo = {
                            fieldName,
                            dataType,
                            isNullable
                        };
                        if (fieldLength) {
                            itemFieldInfo.length = fieldLength
                        }
                        if(fieldPrecision) {
                            itemFieldInfo.precision = fieldPrecision;
                            itemFieldInfo.scale = fieldScale;
                        }
                        retval.push(itemFieldInfo);
                    }
                }
            }
        } catch (err) {
            logger.logError('database.populateDatabaseTableInfo()', err);
        }
        return retval;
    }

    /*
    private executeDb2(sqlQuery: string | string[]): Promise<queryResult> {
        return new Promise<queryResult>((resolve, reject) => {
            try {
                let connString = `DATABASE=${this.config.schema};HOSTNAME=${this.config.server};PORT=${this.config.port};PROTOCOL=TCPIP;UID=${this.config.username};PWD=${this.config.password};`;
                if (this.config.ssl) {
                    connString += 'SECURITY=SSL;';
                }
                let connection = db2.openSync(connString);
                let rowCount = 0
                if(Array.isArray(sqlQuery)) { //multiple query
                    for(const qry of sqlQuery) {
                        connection.querySync(qry);
                    }
                }
                else { //single query
                    let stmt = connection.prepareSync(sqlQuery);
                    rowCount = stmt.executeNonQuerySync();
                }
                connection.closeSync();
                resolve({ rowCount, data: [] });
            } catch (err) {
                reject(err);
                logger.logError('database.executeDb2()', err);
            }
        });
    }
    */

}
let database = new _database();

export { database };