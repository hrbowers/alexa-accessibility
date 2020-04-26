
var AWS = require("aws-sdk");
AWS.config.update({ region: "us-east-1" });
const tableName = "poa-storage"; //Dynamo table name

var dbConnect = function () { };
//DocClient provides more dev friendly abstraction for DynamoDB actions
var docClient = new AWS.DynamoDB.DocumentClient();

/**
 * Saves a complete POA to the appropriate DynamoDB Table.
 */
dbConnect.prototype.addPoa = (poaID, data1, data2, data3) => {

    return new Promise((resolve, reject) => {

        //Parameters for the POA
        const params = {
            TableName: tableName,
            Item: {
                //Partition ID is the primary key
                'poaId': poaID,
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

/**
 * Retrieves a specific infraction from the 'infraction' DynamoDB 
 * table based on an infraction id.  Retrieving the infraction
 * allows the skill to then direct the user to either the POA 
 * process or the SR process.
 */
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
            console.log("GetInfraction succeeded:", JSON.stringify(data, null, 2), typeof (data));
            resolve(data)
        })
    })
}

/**
 * Updates an existing POA with new information.  For this skill, it adds new
 * information to an incomplete POA or to the Reply slot on a complete POA.
 */
dbConnect.prototype.updatePOA = (poaId, d1, d2, d3, reply) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: 'poa-storage',
            Key: {
                'poaId': poaId
            },
            UpdateExpression: "set rootCause = :d1, actionTaken = :d2, preventativeMeasure = :d3, reply = :r",
            ExpressionAttributeValues: {
                ":d1": d1,
                ":d2": d2,
                ":d3": d3,
                ":r": reply
            }
        }

        docClient.update(params, (err, data) => {
            if (err) {
                console.error("Error updating: ", JSON.stringify(err));
                return reject(JSON.stringify(err));
            }
            console.log("Update OK: ", JSON.stringify(data))
            resolve(data);
        })
    });
}

/**
 * Retrieves the account information from the sample-account-status table.
 * This information includes the status code of the account, the locale of
 * the account, the ID of any under review POAs, and an array of all infractions
 * that need fixing.
 */
dbConnect.prototype.getAccount = () => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: 'sample-account-status',
            Key: {
                'accountId': 1
            }
        }
        docClient.get(params, (err, data) => {
            if (err) {
                console.error("Can not get. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            }
            console.log("GetItem succeeded:", JSON.stringify(data, null, 2), typeof (data));
            resolve(data)
        })
    });
}

/**
 * Retrieves an incomplete or under review POA based on the poaId. This
 * enables the Resume and Reply functionality.
 */
dbConnect.prototype.getPOA = (poaId) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: 'poa-storage',
            Key: {
                'poaId': poaId
            }
        }
        docClient.get(params, (err, data) => {
            if (err) {
                console.error("Can not get. Error JSON:", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            }
            console.log("Get POA succeeded:", JSON.stringify(data, null, 2), typeof (data));
            resolve(data)
        })
    });
}

/**
 * Updates the status of the account.  This should only be called before the skill exits
 * in order to reduce unneccessary calls to the Dynamo table.  Status Values:
 * 
 * 0 = Account in good standing
 * 1 = Account enforced.  Requires either a POA or the SR process to resolve
 * 2 = In progress.  If an incomplete POA exists on the account it must be completed
 * 3 = Under review.  If there is a complete POA on the account it can have more information added.
 * 
 * poaId Values:
 * noPOA = After completing the SR process, if there are no incomplete or under review POAs the status
 * should be set to 0 and the poaId should be set to this value to indicate that there are no POAs
 * associated with the account.
 * int = If there is an incomplete or under review POA on the account the poaId should be set as an int
 * for later retrieval.
 */
dbConnect.prototype.updateStatus = (status, poaId) => {
    return new Promise((resolve, reject) => {
        const params = {
            TableName: 'sample-account-status',
            Key: {
                'accountId': 1
            },
            UpdateExpression: "set statusCode = :s, poaId = :id",
            ExpressionAttributeValues: {
                ":s": status,
                ":id": poaId
            }
        }

        docClient.update(params, (err, data) => {
            if (err) {
                console.error("Error updating: ", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            }
            console.log("Update successful: ", JSON.stringify(data));
            resolve(data)
        })
    });
}

/**
 * At the end of the skill process, this updates the array of infractions on the account.
 * Any infraction that were resolved are simply removed from the array.
 */
dbConnect.prototype.updateInfractionArray = (array, index, accountId) => {
    var newArray = [];
    if (index > 0) {
        for (var i = 0; i < index; i++) {
            array.shift();
        }
        newArray = array;
    }
    return new Promise((resolve, reject) => {
        const params = {
            TableName: 'sample-account-status',
            Key: {
                'accountId': accountId
            },
            UpdateExpression: `set infractionArray = :N`,
            ExpressionAttributeValues: {
                ":N": newArray,
            }
        }

        docClient.update(params, (err, data) => {
            if (err) {
                console.error("Error updating: ", JSON.stringify(err, null, 2));
                return reject(JSON.stringify(err, null, 2))
            }
            console.log("Update successful: ", JSON.stringify(data));
            resolve(data)
        })
    });
}
module.exports = new dbConnect();