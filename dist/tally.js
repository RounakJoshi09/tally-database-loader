"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tally = void 0;
const fs = require("fs");
const path = require("path");
const process = require("process");
const http = require("http");
const utility_js_1 = require("./utility.js");
const logger_js_1 = require("./logger.js");
const database_js_1 = require("./database.js");
class _tally {
    constructor() {
        this.lstMasters = ['mst_group', 'mst_ledger', 'mst_vouchertype', 'mst_uom', 'mst_godown', 'mst_stock_group', 'mst_stock_item', 'trn_closingstock_ledger'];
        this.lstTransactions = ['trn_voucher', 'trn_accounting', 'trn_inventory'];
        this.config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))['tally'];
    }
    updateCommandlineConfig(lstConfigs) {
        if (lstConfigs.has('tally-server'))
            this.config.server = lstConfigs.get('tally-server') || '';
        if (lstConfigs.has('tally-port'))
            this.config.port = parseInt(lstConfigs.get('tally-port') || '9000');
        if (lstConfigs.has('tally-master'))
            this.config.master = lstConfigs.get('tally-master') == 'true';
        if (lstConfigs.has('tally-transaction'))
            this.config.transaction = lstConfigs.get('tally-transaction') == 'true';
        if (lstConfigs.has('tally-fromdate') && lstConfigs.has('tally-todate')) {
            let fromDate = lstConfigs.get('tally-fromdate') || '';
            let toDate = lstConfigs.get('tally-todate') || '';
            this.config.fromdate = /^\d{4}-\d{2}-\d{2}$/g.test(fromDate) ? fromDate : 'auto';
            this.config.todate = /^\d{4}-\d{2}-\d{2}$/g.test(toDate) ? toDate : 'auto';
        }
    }
    importData() {
        return new Promise(async (resolve, reject) => {
            try {
                //update active company information before starting import
                logger_js_1.logger.logMessage('Updating company information configuration table');
                await this.saveCompanyInfo();
                //prepare substitution list of runtime values to reflected in TDL XML
                let configPeriod = new Map();
                configPeriod.set('fromDate', utility_js_1.utility.Date.parse(this.config.fromdate, 'yyyy-MM-dd'));
                configPeriod.set('toDate', utility_js_1.utility.Date.parse(this.config.todate, 'yyyy-MM-dd'));
                //truncate master/transaction tables
                logger_js_1.logger.logMessage('Erasing database');
                for (let i = 0; i < this.lstMasters.length; i++) {
                    let targetTable = this.lstMasters[i];
                    await database_js_1.database.execute(`truncate table ${targetTable};`);
                }
                for (let i = 0; i < this.lstTransactions.length; i++) {
                    let targetTable = this.lstTransactions[i];
                    await database_js_1.database.execute(`truncate table ${targetTable};`);
                }
                //delete and re-create CSV folder
                if (fs.existsSync('./csv'))
                    fs.rmSync('./csv', { recursive: true });
                fs.mkdirSync('./csv');
                //dump data exported from Tally to CSV file required for bulk import
                logger_js_1.logger.logMessage('Generating CSV files from Tally');
                if (this.config.master)
                    for (let i = 0; i < this.lstMasters.length; i++) {
                        let targetTable = this.lstMasters[i];
                        await this.processMasterReport(targetTable, configPeriod);
                        logger_js_1.logger.logMessage('  saving file %s.csv', targetTable);
                    }
                if (this.config.transaction)
                    await this.processTransactionReport(configPeriod);
                //perform CSV file based bulk import into database
                logger_js_1.logger.logMessage('Loading CSV files to database tables');
                if (this.config.master)
                    for (let i = 0; i < this.lstMasters.length; i++) {
                        let targetTable = this.lstMasters[i];
                        let rowCount = await database_js_1.database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.csv`), targetTable);
                        logger_js_1.logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                    }
                if (this.config.transaction)
                    for (let i = 0; i < this.lstTransactions.length; i++) {
                        let targetTable = this.lstTransactions[i];
                        let rowCount = await database_js_1.database.bulkLoad(path.join(process.cwd(), `./csv/${targetTable}.csv`), targetTable);
                        logger_js_1.logger.logMessage('  %s: imported %d rows', targetTable, rowCount);
                    }
                resolve();
            }
            catch (err) {
                logger_js_1.logger.logError('tally.processMasters()', err);
                reject();
            }
        });
    }
    postTallyXML(msg) {
        return new Promise((resolve, reject) => {
            try {
                let req = http.request({
                    hostname: 'localhost',
                    port: 9000,
                    path: '',
                    method: 'POST',
                    headers: {
                        'Content-Length': Buffer.byteLength(msg, 'utf16le'),
                        'Content-Type': 'text/xml;charset=utf-16'
                    }
                }, (res) => {
                    let data = '';
                    res
                        .setEncoding('utf16le')
                        .on('data', (chunk) => {
                        let result = chunk.toString() || '';
                        data += result;
                    })
                        .on('end', () => {
                        resolve(data);
                    })
                        .on('error', (httpErr) => {
                        logger_js_1.logger.logMessage('Unable to connect with Tally');
                        reject(httpErr);
                        logger_js_1.logger.logError('tally.postTallyXML()', httpErr);
                    });
                });
                req.on('error', (reqError) => {
                    reject(reqError);
                    logger_js_1.logger.logError('tally.postTallyXML()', reqError);
                });
                req.write(msg, 'utf16le');
                req.end();
            }
            catch (err) {
                reject(err);
                logger_js_1.logger.logError('tally.postTallyXML()', err);
            }
        });
    }
    ;
    substituteTDLParameters(msg, substitutions) {
        let retval = msg;
        substitutions.forEach((v, k) => {
            let regPtrn = new RegExp(`\\{${k}\\}`);
            if (typeof v === 'string')
                retval = retval.replace(regPtrn, utility_js_1.utility.String.escapeHTML(v));
            else if (typeof v === 'number')
                retval = retval.replace(regPtrn, v.toString());
            else if (v instanceof Date)
                retval = retval.replace(regPtrn, utility_js_1.utility.Date.format(v, 'd-MMM-yyyy'));
            else if (typeof v === 'boolean')
                retval = retval.replace(regPtrn, v ? 'Yes' : 'No');
            else
                ;
        });
        return retval;
    }
    processTdlOutputManipulation(txt) {
        let retval = txt;
        retval = retval.replace(/[\r\n\t]/g, '');
        retval = retval.replace(/õ/g, '');
        retval = retval.replace(/,\"†\",/g, '\r\n');
        return retval;
    }
    processMasterReport(targetTable, substitutions) {
        return new Promise(async (resolve, reject) => {
            try {
                let xml = fs.readFileSync(`./xml/${targetTable}.xml`, 'utf-8');
                if (substitutions && substitutions.size)
                    xml = this.substituteTDLParameters(xml, substitutions);
                let output = await this.postTallyXML(xml);
                output = this.processTdlOutputManipulation(output);
                fs.writeFileSync(`./csv/${targetTable}.csv`, output);
                resolve();
            }
            catch (err) {
                logger_js_1.logger.logError(`tally.processMasterReport(${targetTable})`, err);
                reject(err);
            }
        });
    }
    processTransactionReport(substitutions) {
        return new Promise(async (resolve, reject) => {
            try {
                let xml = fs.readFileSync(`./xml/trn_voucher.xml`, 'utf-8');
                if (substitutions && substitutions.size)
                    xml = this.substituteTDLParameters(xml, substitutions);
                let output = await this.postTallyXML(xml);
                output = this.processTdlOutputManipulation(output);
                let csvVoucher = '', csvAccounting = '', csvInventory = '';
                let lstLines = output.split(/\r\n/g);
                for (let i = 0; i < lstLines.length; i++) {
                    let line = lstLines[i];
                    if (line.startsWith('"V"'))
                        csvVoucher += line.substr(4) + '\r\n';
                    else if (line.startsWith('"A"'))
                        csvAccounting += line.substr(4) + '\r\n';
                    else if (line.startsWith('"I"'))
                        csvInventory += line.substr(4) + '\r\n';
                    else
                        ;
                }
                fs.writeFileSync('./csv/trn_voucher.csv', csvVoucher);
                logger_js_1.logger.logMessage('  saving file %s.csv', 'trn_voucher');
                fs.writeFileSync('./csv/trn_accounting.csv', csvAccounting);
                logger_js_1.logger.logMessage('  saving file %s.csv', 'trn_accounting');
                fs.writeFileSync('./csv/trn_inventory.csv', csvInventory);
                logger_js_1.logger.logMessage('  saving file %s.csv', 'trn_inventory');
                resolve();
            }
            catch (err) {
                logger_js_1.logger.logError(`tally.processTransactionReport()`, err);
                reject(err);
            }
        });
    }
    saveCompanyInfo() {
        return new Promise(async (resolve, reject) => {
            try {
                let xmlCompany = fs.readFileSync('./xml/mst_company.xml', 'utf-8');
                let strCompanyInfo = await this.postTallyXML(xmlCompany); //extract active company information
                if (strCompanyInfo.endsWith(',"†",\r\n')) {
                    strCompanyInfo = strCompanyInfo.replace(/\",\"†\",\r\n/g, '').substr(1);
                    let lstCompanyInfoParts = strCompanyInfo.split(/\",\"/g);
                    let companyName = lstCompanyInfoParts[1];
                    companyName = companyName.replace(/'/g, '\\"');
                    if (this.config.fromdate == 'auto' || this.config.todate == 'auto') { //auto assign from/to from company info for detection mode
                        this.config.fromdate = lstCompanyInfoParts[2];
                        this.config.todate = lstCompanyInfoParts[3];
                    }
                    //clear config table of database and insert active company info to config table
                    await database_js_1.database.execute('truncate table config;');
                    await database_js_1.database.execute(`insert into config(name,value) values("Update Timestamp","${new Date().toISOString()}"),("Company Name","${companyName}"),("Period From","${this.config.fromdate}"),("Period To","${this.config.todate}");`);
                }
                else {
                    reject('Cannot detect First/Last voucher date from company');
                }
                resolve();
            }
            catch (err) {
                logger_js_1.logger.logError(`tally.saveCompanyInfo()`, err);
                reject(err);
            }
        });
    }
}
let tally = new _tally();
exports.tally = tally;
//# sourceMappingURL=tally.js.map