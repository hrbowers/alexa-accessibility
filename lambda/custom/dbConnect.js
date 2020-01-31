var AWS = require("aws-sdk");
AWS.config.update({ region: "us-east-1" });
const tableName = "poa-storage"; //Dynamo table name

var dbConnect = function () { };
//DocClient provides more dev friendly abstraction for DynamoDB actions
var docClient = new AWS.DynamoDB.DocumentClient(); 

//Connect to the DynamoDB table and store the POA
//For this skill we should only need the create part of CRUD.
//If the scope expands, we might need the update portion as well.
dbConnect.prototype.addPoa = (poaID,data1,data2,data3) => {

    return new Promise((resolve, reject) => {

        //Parameters for the POA
        const params = {
            TableName: tableName,
            Item: {
                //Partition ID is the primary key
                'poaId': poaID,
                //User enteries added as item attributes
                //todo1, todo2, and todo3 are placeholders
                'rootCause': data1,
                'actionTaken': data2,
                'preventativeMeasure': data3
            }
        };

        //store params into the table
        docClient.put(params, (err, data) => {
            if (err) {
                console.log("Error inserting into table: ", JSON.stringify(err))
                return reject("Insertion Error");
            }

            console.log("Successfully inserted: ", JSON.stringify(data));
            resolve(data);
        });//end put

    });//end promise
}

dbConnect.prototype.getTestValue = () => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: 'sample-account-status',
            Key: {
                'accountId':1
            }
        }
        docClient.get(params, (err, data) => {
            if (err) {
                console.error("Can not get. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            } 
            console.log("GetItem succeeded:", JSON.stringify(data, null, 2),typeof(data));
            resolve(data)            
        })
    });
}

dbConnect.prototype.updateStatus = (status) => {
    return new Promise((resolve,reject) => {
        const params ={
            TableName: 'sample-account-status',
            Key: {
                'accountId':1
            },
            UpdateExpression: "set statusCode = :s",
            ExpressionAttributeValues:{
                ":s":status
            }
        }

        docClient.update(params,(err,data) => {
            if(err) {
                console.error("Error updating: ", JSON.stringify(err,null,2));
                return reject(JSON.stringify(err,null,2))
            }
            console.log("Update successful: ",JSON.stringify(data));
            resolve(data)
        })
    });
}

module.exports = new dbConnect();