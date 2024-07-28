## Release History


**Version: 1.0.28 [28-Jul-2024]**<br>
Fixed:
* Better and easily understandable error messages.
* Minor code refinement.

Added:
* Introduced setting named **frequency** in config.json which when enabled (i.e. set to greater than zero), will keep on monitoring Tally company for changes continuously every *n* minute. If any changes are found, then it will trigger sync.


**Version: 1.0.28 [22-Jun-2024]**<br>
Fixed:
* **config** table of database was not getting populated for Google BigQuery
* Re-arranging steps of sync (for **full** sync mode), to reduce the time frame between older rows of database tables are cleared and fresh data is loaded

Added:
* **banker_date** field in table **trn_bank** required for preparing bank reconciliation report
* CommonJS transition to ES Module to keep utility code aligned to new method of development. As a result, files with extension **.js** will now appear as **.mjs** in **dist** folder of utility. This change has no implication on functionality or performance of the utility.

**Version: 1.0.27 [20-May-2024]**<br>
Fixed:
* Field GSTN and GST Registration Type were populated as blank in few scenario. Extration expression fixed to handle those scenarios
* Optimizations in incremental sync to speed it up

Added:
* Incremental Sync is not supported for PostgreSQL &amp; MySQL

**Version: 1.0.26 [01-May-2024]**<br>
Fixed:
* Count of rows imported now displayed for Google BigQuery.
* Timeout error where query for SQL Server used to take more than 15000 ms.

Added:
* Documentation now enhanced.

Note: As incremental sync is not stable &amp; very less users using it, so the default structure is reverted back to full sync version. Incremental sync compatible version of the file **database-structure.sql** and **tally-export-config.yaml** have been moved to folder **incremental**. Users interested in experimenting this feature should download and overwrite this folders files on the existing.

**Version: 1.0.25 [21-Apr-2024]**<br>
Fixed:
* GST fields were not displaying correct value in **mst_stock_item** table, now fixed.
* Batch Name in table **trn_batch** was displaying blank, now fixed.
* **port** setting under database in **config.json** file can be kept to value as **0** which will apply default port settings.

Added:
* alternate unit and conversion field added in table **mst_stock_item** for reporting purpose.
* table **trn_bank** introuduced to capture banking related information for receipt / payment / contra vouchers.
* Powershell scripts to determine names of open companies in Tally
* Powershell scripts to automate multi company sync

**Version: 1.0.24 [31-Mar-2024]**<br>
Fixed:
* In table **mst_stock_item** field name **gst_nature_of_goods** is now re-named as **gst_type_of_supply** to describe it correctly
* Resolved blank information related to GST fields in table **mst_stock_item**
* Table **mst_godown** parent GUID fixed
* Table row count were not displayed for PostgreSQL when loadmetho was set to file to enable fast data loading, now fixed

Added:
* 2 more fields in **mst_stock_item** related to GST are added
* Added two more tables named **mst_stockitem_standard_cost** and **mst_stockitem_standard_price** to capture standard cost/price for the stock items

**Version: 1.0.23 [17-Feb-2024]**<br>
Fixed:
* Azure Data Lake Gen2, can now automatically generate *model.json* metadata file based on *tally-export-config.yaml*

**Version: 1.0.22 [15-Oct-2023]**<br>
Added:
* Azure Data Lake Gen2 connectivity to push CSV files to data lake, which can be imported via Excel, Power BI, etc.
* Enabled loading of local PC CSV files into database server via bulk load / copy feature of database (applicable for SQL Server / PostgreSQL / MySQL), for a faster loading when data volume is bigger
Fixed:
* MySQL connector authentication issue. Older version of MySQL connector library supported Legacy authentication which is no longer used and will be removed in future from MySQL. So upgraded the connector library to support CACHING_SHA2_PASSWORD authentication which is more secure.

**Version: 1.0.21 [16-Apr-2023]**<br>
Added:
* Field **affects_gross_profit** in mst_group table for calculation of Gross Profit / Net Profit
* Utility version identification
* SQL queries for few reports

**Version: 1.0.20 [20-Feb-2023]**<br>
Fixed:
* Incorrect datatype of reference_date field was mentioned in tally-export-config.json causing empty dates in that field, now fixed.

**Version: 1.0.19 [13-Feb-2023]**<br>
Fixed:
* Last row of data was getting skipped in SQL Server in *file* mode due to missing last line terminator, now fixed.

**Version: 1.0.18 [22-Jan-2023]**<br>
Added:
* Reference Date field in trn_voucher to capture supplier invoice date
* Option to sync Master or/and Transaction which was removed in previous release, was again added back, but not as a setting in config.json, but as a hidden commandline flag. (eg --tally-transaction false). This feature was provided for having control on multi year sync with huge volume of data. With this flag, now user can perform sync in multiple batches instead of doing it in single batch. Example demonstrated in command-line section of help.
* By default utility cleared all data from existing database before sync. A hidden commandline flag (--tally-truncate false) is introduced, which allows multi year sync in batches without clearing existing data when running utility again.

Fixed:
* Reference Number field of trn_voucher was found empty. Now fixed with correction in field name.
* Command line flags were not being detected correctly, now fixed.
* Minor fixes in incremental sync


**Version: 1.0.17 [24-Jul-2022]**<br>
Added:
* Introduced feature **incremental sync** using which utility can sync specifically those masters and transactions which got added / deleted / modified from last sync point. This resulted in drastic performance boost, as only differencial data is pull out from Tally. It opens an opportunity to auto schedule (using Windows Task Schedule) sync to lower frequency like every 5 min, which will help to keep data near to realtime in database.
* Option to keep port or username in datase config setting zero/blank, which will auto-populate default values

Fixed:
* Changed Tally XML Server output method from CSV to XML, since Tally was found to be skipping few fields when no value was found, thereby breaking CSV output.
* Unicode text (i.e. Hindi, or any Indian language text) using insert method was were not displaying correctly, now fixed.
* Changed bulk data loading of data for SQL Server from CSV (comma separate) to TSV (tab separated). This resulted in compatibility for bulk loading in SQL Server 2016 or older one.

Removed:
* Option to sync Master or/and Transaction separately. This option was creating data integrity issues, so it was removed from *config.json* totally .


**Version: 1.0.16 [21-Jun-2022]**<br>
Added:
* Field named *order_duedate* introduced in trn_inventory table

**Version: 1.0.15 [09-Jun-2022]**<br>
Added:
* Loading of Tally data directly into Google BigQuery dataset
* Field named *alias* introduced in few master tables. *order_number* field introduced in Inventory Transactions

Fixed:
* OpeningBalance (in quantity) was giving absolute value, now fixed
* SQL Server insert mode failed in few scenario if 1000+ records were added in single batch. Now batch is restricted to 1000 records

**Version: 1.0.14 [28-Feb-2022]**<br>
Fixed:
* Commandline config --tally-fromdate and --tally-todate was not effecting from/to date while sending export request to Tally, now corrected

**Version: 1.0.13 [21-Feb-2022]**<br>
Fixed:
* Due to undocumented breaking changes in Tally Prime 2.0.1 export functionality was affected, now restored with fresh code changes
* In few cases, utility was not getting list of open companies from Tally Prime properly, now fixed
* PostgreSQL SSL connection was being rejected for self-signed certificates, now fixed by setting ignore flag

**Version: 1.0.12 [20-Nov-2021]**<br>
Added:
* Support of Postgre SQL Database Server Server.
* SSL (Secured Socket Layer) database connections for secure exchange of data especially for cloud database (PostgreSQL / SQL Server).

Fixed:
* Use of single quotes in INSERT statement, string type values, instead of double quotes, to bring uniformity of SQL Statements across multiple RDBMS platforms.
* CSV folder was used as parking space for intermediate process in database import method. Now the folder is deleted once data is imported successfully into database.

**Version: 1.0.11 [07-Nov-2021]**<br>
Fixed:
* Introduced specific error message related to database and connectvity.
* Reduced repetation of call stack in error messages to once for improved error diagnostic.

**Version: 1.0.10 [10-Oct-2021]**<br>
Added:
* 2 new fields in **trn_voucher** table. Party field was added for easy determination of Sundry Debtor / Creditor in any transaction and optimized aggregation.

**Version: 1.0.9 [08-Aug-2021]**<br>
Added:
* 2 new fields of amount in forex and currency in **trn_accounting** table. For Indian currency transaction, this field amount will be same as amount field.

Fixed:
* Crashing of Tally in the case when compound unit of measurement was used. TDL extraction expression is fixed.
* Failure in fetching data from specific company, when target company name was specified in **config.json** . Mechanism was failing when company had special characters like dash, brackets in its name.
* Default date in SQL queries in demo report section, changed to FY 2020-21.

**Version: 1.0.8 [01-Jul-2021]**<br>
Added:
* Rate column in stock item and inventory transaction table
* Added 2 new tables for opening batch & bill allocation (useful when company is split and there are pending bills as on split date)
* Introduced compatibility for field containing **rate** type of data in Tally. YAML export configuration now supports type *rate*

**Version: 1.0.7 [23-Jun-2021]**<br>
Added:
* Table named mst_gst_effective_rate containing rate of GST applicable on different stock item on multiple dates
* Email and Bank details related fields into mst_ledger table
* Power BI template for importing CSV files into Power BI model, is made available

Fixed:
* Exporting date type fields with blank value from Tally was causing issue while import. So now empty date field will be treated as NULL for database. During CSV export, same fields will remain as blank
* UTF-8 BOM (Byte Order Mark) is emmited to CSV files, when choosing CSV export in config.json so Without BOM, any field containing Unicode value was not decoded properly by excel

**Version: 1.0.6 [11-Jun-2021]**<br>
Fixed:
* Parent nature field of Tally containing value Primary, is converted to value as blank string, by custom TDL expression in YAML. In few tables this expression was missing, which is now fixed

**Version: 1.0.5 [05-Jun-2021]**<br>
Added:
* YAML format tally tables & fields definition specification file **tally-export-config.yaml**, for easy expansion of User Defined Fields as utility now aims for easy export of fields created by TDL Developers customising Tally. TDL XML is created on-the-fly by reading this specification file.
* Timestamps in **import-log.txt** file, to know exactly when utility was run
* No of seconds it took for each table of Tally to export. This information might be helpful when user wants to skip any heavy tables of Tally from export, by removing it from **tally-export-config.yaml** specification file for quick export

Removed:
* XML folder containing specification of Tally tables and fields, as this XML is now automatically created on-the-fly. Also *table-info.json* file was removed, as **tally-export-config.yaml** already contains equivalent name of fields in database for corresponding Tally fields.
* In **config.json** file, **batch** mode of transaction export where we could specify it full or daily is removed, as whole logic is now revamped. Revamping of logic resulted in longer time to export data from Tally, but significant lower usage of RAM while export (as high RAM usage by Tally Prime was hindering other process in few cases)

Version: **1.0.4 [17-May-2021]**<br>
Added:
* Support for selecting specific company from which to export data (using Powershell script loop can be setup to automate this for multiple companies)
* Voucher Reference number field added
* 5 more tables added related to cost centre, bill reference, batch allocation

Version: **1.0.3 [24-Apr-2021]**<br>
Added:
* SQL Queries for generating reports in a folder named **reports**. Due to difference in SQL functions names and syntax nomenclature in MySQL and MS-SQL, query for same report is made available for both database technologies
* Option to simply generate CSV files dump and then exit utility, by setting **technology** as **csv** in **config.json**. This option is introduced with an aim of transferring these CSV dumps to PC when Database Server is not directly accessible via Network (LAN/Internet). Also, these files can be used for **Google BigQuery** schema tables loading for cloud-based reporting

Fixed:
* CSV file dump, adopted ISO date format of **YYYY-MM-DD** instead of YYYYMMDD for easy detection of dates by Database Server
* Database table **trn_voucher**  field **date** was erronously assigned *datetime* data type instead of *date* now fixed

Version: **1.0.2 [12-Apr-2021]**<br>
Added:
* A configuration option **batch** has been added to handle cases where export of large number transaction rows from Tally in a single HTTP request results in freezing of Tally (due to huge amount of RAM usage). So, assigning value **daily** to this settings exports transactions (or vouchers) data day-by-day into CSV file and then pushes it to Database at once.
* New fields of Tally related to GST (HSN Code, type of supply, etc) have been added in *stock item* table
* 3 more flag type of fields added to *voucher* table to determine if voucher is of type accounting / inventory / order. These fields speed-up SQL Query for calculating of closing balance as on date

Fixed:
* **port** and **server** settings for *Tally* section in the file **config.json** were not effected if default value was overriden. This issue is now fixed
* In **file** based loading mode, first row of CSV file containing header was even treated as data row. So modified that query to skip 1 row from top
* SQL Server does not accept text enclosed in *double quotes* in SQL query for row insert by default. Due to this *file* based bulk loading of data failed for MS SQL Server . So modified SQL query for MS SQL Server where *QUOTED_IDENTIFIER* flag is set to *OFF* before the SQL statement


Version: **1.0.1 [06-Apr-2021]**<br>
Added:
* Header column in CSV files is introduced for easy viewing of CSV files from Excel to know exact error. Also these files can easily be imported, if database server is in protected PC with no external access

Fixed:
* \\ character in text field generated invalid CSV files, interrupting database loading. Proper escaping of backslah is now fixed
* Character limit for PAN(10) & GST Number(15) field increased in **database-structure.sql** as older versions of Tally were found to be accepting extra characters
* Closing Stock values for **trn_closingstock_ledger** table were missing 0 if no amount was specified for corresponding date. So now fixed with 0 in amount
* Commandline process exits with code of 0 = Success / 1 = Error, so that any other dependent programs/scripts can utilise this exit code for troubleshooting


Version: **1.0.0 [26-Mar-2021]**<br>
* Utility released