
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


dbConnect.prototype.getInfraction = (infractionID) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: 'infraction',
            Key: {
                'infractionId': infractionID
            }
        }
        docClient.get(params, (err, data) => {
            if (err) {
                console.error("Cannot get. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2));
            }
            console.log("GetInfraction succeeded:", JSON.stringify(data, null, 2),typeof(data));
            resolve(data)
        })
    })
}
// Ideally we'd pass an account ID into this and utilize that to determine whos
// information we are gathering.
dbConnect.prototype.getInfractionArray = () => {
    return new Promise((resolve,reject) => {
        const params = {
            TableName: 'sample-account-status',
            Key: {
                'accountId':2
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
    })
}

dbConnect.prototype.updatePOA = (poaId,reply) => {
    return new Promise((resolve,reject) => {
        const params = {
            TableName: 'poa-storage',
            Key: {
                'poaId':poaId
            },
            UpdateExpression: "set reply = :r",
            ExpressionAttributeValues:{
                ":r":reply
            }
        }

        docClient.update(params,(err,data) => {
            if(err){
                console.error("Error updating: ", JSON.stringify(err));
                return reject(JSON.stringify(err));
            }
            console.log("Update OK: ",JSON.stringify(data))
            resolve(data);
        })
    });
}

dbConnect.prototype.getTestValue = () => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: 'sample-account-status',
            Key: {
                'accountId':2
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


dbConnect.prototype.updateStatus = (status,poaId) => {
    return new Promise((resolve,reject) => {
        const params ={
            TableName: 'sample-account-status',
            Key: {
                'accountId':1
            },
            UpdateExpression: "set statusCode = :s, poaId = :id",
            ExpressionAttributeValues:{
                ":s":status,
                ":id":poaId
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

dbConnect.prototype.updateInfractionArray = (array, index, accountId) => {
    var newArray = [];
    var j = 0;
    for(var i = index + 1; i < array.length; i++) {
        newArray[j++] = array[i];
    }
    for(var i = 0; i < index + 1; i++) {
        newArray[j++] = -1;
    }
    return new Promise((resolve,reject) => {
        const params ={
            TableName: 'sample-account-status',
            Key: {
                'accountId':accountId
            },
            UpdateExpression: "set infractionArray = :N",
            ExpressionAttributeValues:{
                ":N": newArray,
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