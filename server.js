// ======================================
//         INITIALIZING DEPENDENCIES
// ======================================
const express = require('express');
app = express(),
bodyParser = require("body-parser"),
AWS = require('aws-sdk'),
cookieParser = require('cookie-parser'),
fs = require("fs"),
path = require("path"),
{spawn} = require('child_process'),
multer = require('multer'),
ms = require("ms"),
download = require('download-file'),
execFile = require('child_process').execFile;


// ================================================
//            SERVER CONFIGURATION
// ================================================
function setConnectionTimeout(time) {
    var delay = typeof time === 'string'
    ? ms(time)
    : Number(time || 5000);

    return function (req, res, next) {
        res.connection.setTimeout(delay);
        next();
    }
}

// ======================================
//         	GLOBAL VARIABLES
// ======================================

const successMessage = "success";
const failureMessage = "failure";
const apiPrefix = "/api/"

// ======================================
//       CONFIGURING AWS SDK & EXPESS
// ======================================
// Avatar Configuration

var config = {

    "awsAccessKeyId": process.env.AWSACCESSKEYID,
    "awsSecretAccessKey": process.env.AWSACCESSSECRETKEY,
    "avatar3dClientId": process.env.AVATAR3DCLIENTID,
    "avatar3dclientSecret": process.env.AVATAR3DCLIENTSECRET,
    "region" : process.env.REGION,
    "usersbucket": process.env.USERSBUCKET,
    "apiVersion" : process.env.APIVERSION

};

var config_env = config ;
//var config = require('./config/configuration_keys.json');
//config_env = config;

//AWS.config.loadFromPath('./config/configuration_keys.json');
const BUCKET_NAME = config_env.usersbucket;

// AWS Credentials loaded
var myconfig = AWS.config.update({
    accessKeyId: config_env.awsAccessKeyId, secretAccessKey: config_env.awsSecretAccessKey, region: config_env.region
});
var storage = multer.memoryStorage()
var upload = multer({
    storage: storage
});

var s3 = new AWS.S3();

const docClient = new AWS.DynamoDB.DocumentClient({
    convertEmptyValues: true
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ===========================================
//     UTILITY FUNCTIONS
// ===========================================

function concatArrays(arrays) {
    return [].concat.apply([], arrays);
}


// ======================================
//              FUNCTIONS
// ======================================

function executeShellCommands(cmd) {
    return new Promise((resolve, reject) => {
        var command = spawn(cmd, { shell: true })
        var result = ''
        command.stdout.on('data', function (data) {
            result += data.toString()
        })
        command.on('close', function (code) {
            resolve(result)
        })
        command.on('error', function (err) { reject(err) })
    })
}


function generate3DModel(obj){
    console.log(obj);
    return new Promise((resolve, reject)=> {


        const pythonProcess = spawn("python", [
            __dirname + "/config/AvatarTest.py",
            obj.image_url,
            config.avatar3dClientId,
            config.avatar3dclientSecret,
            obj.user_cognito_id
        ]);
        pythonProcess.stdout.on("data", data => {

            execFile('zip', ['-r', `./avatars/${obj.user_cognito_id}.zip`, `./avatars/${obj.user_cognito_id}/`], function(err, stdout) {
                if(err){
                    console.log("ERROR in file upload ",err);
                    reject(err);
                }
                else{
                    console.log("",stdout);
                    resolve(stdout);
                }
            });
        })
        pythonProcess.stderr.on("data", data => {
            console.log(`error:${data}`);
            reject(data);

        });
        pythonProcess.on("close", data => {
            if (data == "1" || data == 1) {
                reject(data);
            }
            console.log(`child process close with ${data}`)
        });





    })
}





function getFileSignedUrl(key, cb) {

    var params = {
        Bucket: BUCKET_NAME,
        Key: key
    };
    s3.getSignedUrl('getObject', params, function (err, url) {
        if (err) {
            cb(err, "");
        } else {
            cb("", url);
        }
    });
}

function getUploadedModelFileList(user_name, cb) {
    const s3Params = {
        Bucket: BUCKET_NAME,
        Delimiter: '/',
        Prefix: user_name + '/profile/model/'
        // Key: req.query.key + ''
    };

    s3.listObjectsV2(s3Params, (err, data) => {
        if (err) {
            //   console.log(err);
            cb(err, "");
        }
        console.log(data);
        cb("", data.Contents);
    });

}
function upload3DModelZip(obj,cb){
    console.log("IN UPLOAD MODEL");
    var uploadParams = {
        Bucket: config.usersbucket,
        Key: `${obj.user_cognito_id}/profile/model/${obj.file_name}.zip`, // pass key
        Body: null,
    };
    fs.readFile(`./avatars/${obj.user_cognito_id}.zip`, function (err, headBuffer) {
        if (err) {
            console.log(err);
            cb(err,'');
        }
        else {
            uploadParams.Body = headBuffer;
            s3.upload(uploadParams, (err, data) => {
                if (err) {
                    cb(err,'');
                }
                else {
                    cb('',data);
                }
            });

        }
    })

}

function uploadINPFile(user_id,timestamp,cb){


    var uploadParams = {
        Bucket: config.usersbucket,
        Key: '', // pass key
        Body: null, // pass file body
    };

    const params = uploadParams;

    fs.readFile(`../users_data/${user_id}/rbf/${timestamp}.inp`, function (err, headBuffer) {
        if (err) {
            cb(err,'');
        }
        else {
            params.Key = user_id + "/profile/rbf/" + timestamp + ".inp";
            params.Body = headBuffer;
            // Call S3 Upload
            s3.upload(params, (err, data) => {
                if (err) {
                    cb(err,'');
                }
                else {
                    cb('',data);
                }
            });

        }
    })

}

function uploadSimulationFile(user_id,timestamp,cb){


    var uploadParams = {
        Bucket: config.usersbucket,
        Key: '', // pass key
        Body: null, // pass file body
    };

    const params = uploadParams;

    fs.readFile(`../users_data/${user_id}/simulation/${timestamp}.png`, function (err, headBuffer) {
        if (err) {
            cb(err,'');
        }
        else {
            params.Key = user_id + "/profile/simulation/" + timestamp + ".png";
            params.Body = headBuffer;
            // Call S3 Upload
            s3.upload(params, (err, data) => {
                if (err) {
                    cb(err,'');
                }
                else {
                    cb('',data);
                }
            });

        }
    })

}


function uploadGeneratedSelfieImage(obj,cb){


    var uploadParams = {
        Bucket: config.usersbucket,
        Key: '', // pass key
        Body: null, // pass file body
    };

    const params = uploadParams;

    fs.readFile(`./avatars/${obj.user_cognito_id}/head/${obj.file_name}.png`, function (err, headBuffer) {
        if (err) {
            cb(err,'');
        }
        else {
            params.Key = `${obj.user_cognito_id}/profile/image/${obj.file_name}.png`;
            params.Body = headBuffer;
            // Call S3 Upload
            s3.upload(params, (err, data) => {
                if (err) {
                    cb(err,'');
                }
                else {
                    cb('',data);
                }
            });

        }
    })

}

function generateSimulationFile(user_id){
    return new Promise((resolve,reject)=>{
        // 1. Do Simulation
        // 2. Post Process Simulation
        // 3. Store the file in DynamoDB

        // Doing Simulation on generic brain.inp file
        var cmd = `cd /home/ubuntu/FemTech/build/examples/ex5;mpirun --allow-run-as-root -np 2  --mca btl_base_warn_component_unused 0  -mca btl_vader_single_copy_mechanism none ex5 brain.inp`
        executeShellCommands(cmd).then((data)=>{

            // Doing Post Processing on simulation
            var timestamp = Date.now();
            cmd = `mkdir -p ../users_data/${user_id}/simulation/ ; cd /home/ubuntu/paraview-image-write ; xvfb-run -a --server-args="-screen 0 1024x768x24" pvpython ~/paraview-image-write/ppr1.py /home/ubuntu/users_data/${user_id}/simulation/${timestamp}.png`;
            executeShellCommands(cmd).then((data)=>{
                uploadSimulationFile(user_id,timestamp,(err,data)=>{
                    if(err){
                        reject(err);
                    }
                    else{

                        resolve(data);

                    }
                })

            })
            .catch((error)=>{
                reject(error);
            })

        }).catch((error)=>{
            reject(error);

        })

    })


}





function generateINP(user_id){
    return new Promise((resolve,reject)=>{
        // 1. Get Uploaded model list from user
        // 2. Generate SignedURL of the image
        // 3. Pass the signedURL to download the zip file
        // 4. Generate the INF File
        // 5. Store the INF File in /radio_basis_function/inf file
        getUploadedModelFileList(user_id,(err,list)=>{
            if(err){
                reject(err);
            }
            else{
                // Fetches the latest Model
                var latestModel = list.reduce(function (oldest, latest_model) {
                    return oldest.LastModified > latest_model.LastModified ? oldest : latest_model;
                }, {});

                // Getting the model key
                var model_key ;
                if (list.length != 0) {
                    model_key = latestModel.Key;
                }
                else {
                    model_key = user_id + "/profile/model/" + user_id;
                }
                // Generate SignedURL of the image
                getFileSignedUrl(model_key,(err, url)=> {
                    if(err){
                        reject(err);
                    }
                    else{
                        // Download file
                        var timestamp = Date.now();
                        var zipFileName = timestamp + ".zip";
                        var options = {
                            directory: `../users_data/${user_id}/model/`,
                            filename: zipFileName
                        }
                        download(url, options, function(err){
                            if (err){
                                reject(err);
                            }
                            else{
                                console.log(`python3 ${__dirname}/../PyGeM/tutorials/RBFfinal.py`);
                                executeShellCommands(`python3 ${__dirname}/../PyGeM/tutorials/RBFfinal.py`).then((d)=>{

                                    var cmd = `mkdir -p ../users_data/${user_id}/rbf/ ; ../MergePolyData/build/MergePolyData -in ./brain.vtk -out ../users_data/${user_id}/rbf/brain_morphed.vtk -abaqus ; mv ../users_data/${user_id}/rbf/brain_morphed.inp ../users_data/${user_id}/rbf/${timestamp}.inp ; mv ../users_data/${user_id}/rbf/brain_morphed.vtk ../users_data/${user_id}/rbf/${timestamp}.vtk;`
                                    executeShellCommands(cmd).then((d)=>{


                                        uploadINPFile(user_id,timestamp,(err,data)=>{

                                            if(err){
                                                reject(err);

                                            }
                                            else{
                                                resolve(data);
                                            }


                                        })


                                    }).catch((err)=>{



                                        reject(err);

                                    })
                                }).catch((err)=>{

                                    reject(err);
                                });
                            }
                        })
                    }
                })
            }
        })

    })
}


function updateSelfieAndModelStatusInDB(obj,cb){
    var userParams = {
        TableName: "users",
        Key: {
            "user_cognito_id": obj.user_cognito_id
        },
        UpdateExpression: "set is_selfie_image_uploaded = :selfie_image_uploaded, is_selfie_model_uploaded = :selfie_model_uploaded",
        ExpressionAttributeValues: {
            ":selfie_model_uploaded": true,
            ":selfie_image_uploaded": true,
        },
        ReturnValues: "UPDATED_NEW"
    };
    docClient.update(userParams, (err, data) => {
        if (err) {
            cb(err,'');
        } else {
            cb('',data);
        }
    })



}


function updateINPFileStatusInDB(obj,cb){
    var userParams = {
        TableName: "users",
        Key: {
            "user_cognito_id": obj.user_cognito_id
        },
        UpdateExpression: "set is_selfie_inp_uploaded = :is_selfie_inp_uploaded",
        ExpressionAttributeValues: {
            ":is_selfie_inp_uploaded": true

        },
        ReturnValues: "UPDATED_NEW"
    };
    docClient.update(userParams, (err, data) => {
        if (err) {
            cb(err,'');
        } else {
            cb('',data);
        }
    })

}


function updateSimulationFileStatusInDB(obj,cb){
    var userParams = {
        TableName: "users",
        Key: {
            "user_cognito_id": obj.user_cognito_id
        },
        UpdateExpression: "set is_selfie_simulation_file_uploaded = :is_selfie_simulation_file_uploaded",
        ExpressionAttributeValues: {
            ":is_selfie_simulation_file_uploaded" : true
        },
        ReturnValues: "UPDATED_NEW"
    };
    docClient.update(userParams, (err, data) => {
        if (err) {
            cb(err,'');
        } else {
            cb('',data);
        }
    })

}
function getCumulativeEventPressureData(){
    var myObject = {
        message : "success",
        data : { pressure : [241, 292, 125, 106, 282, 171, 58, 37, 219, 263],
            time_label : [0,5,10,15,20,25,30,35,40,45],
            timestamp : Number(Date.now()).toString()
        }
    }
    return myObject;
}

function getCumulativeEventLoadData(){
    var myObject = {
        message : "success",
        data : { load : [{dataset : [198, 69, 109, 139, 73]}
        ,{dataset : [28, 113, 31, 10, 148]}
        ,{dataset : [28, 2, 1, 10, 148]}
        ,{dataset : [182, 3, 16, 97, 240]}
    ],

    time_label : ["W1","W2","W3","W4","W5"],
    timestamp : Number(Date.now()).toString()
}
}
return myObject;
}

function getHeadAccelerationEvents(){
    var myObject = {
        message : "success",
        data : {
            pressure : [176, 267, 187, 201, 180, 4, 230, 258, 14, 21, 89, 23, 119, 113, 28, 49],
            time_label : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75],
            timestamp : Number(Date.now()).toString()
        }
    }
    return myObject;

}

function getTeamAdminData(){
    var myObject = {
        message: "success",
        data: {
            organization: "York tech Football",
            sports_type: "football",
            roster_count: 3,
            impacts: 4,
            avg_load: 6,
            alerts: 8,
            highest_load : 0.046,
            most_impacts : 7
        }
    }
    return myObject;
}

function getImpactSummary(){
    var myObject =
    {
        message : "success",
        data : {
            pressure : [0,0,0.1,0.5,0.2],
            force : ["20-29g", "30-39g", "40-49g", "50-59g", "60-69g"]
        }
    }
    return myObject ;
}

function getImpactHistory(){
    var myObject =
    {
        message : "success",
        data : {
            pressure : [0.2,0.5,1.0,0.5,0.2,0.5,0.1],
            force : ["20-29g", "30-39g", "40-49g", "50-59g", "60-69g","70-79g","80-89g"]
        }
    }
    return myObject ;

}

function getPlayersData(){
    var myObject = {
        message : "success",
        data : [
            {
                player_name : "Player 1",
                sport : "Football",
                position : "RB",
                alerts : 2,
                impacts : 4,
                load : 0.34
            },
            {
                player_name : "Player 1",
                sport : "Football",
                position : "RB",
                alerts : 2,
                impacts : 4,
                load : 0.32
            },
            {
                player_name : "Player 2",
                sport : "Football",
                position : "FA",
                alerts : 2,
                impacts : 8,
                load : 0.31
            }
        ]
    }

    return myObject ;

}

function getOrganizationAdminData(){
    var myObject = {
        message: "success",
        data: {
            organization: "York tech Football",
            sports_type: "football",
            roster_count: 3,
            impacts: 4,
            avg_load: 6,
            alerts: 8,
            highest_load : 0.046,
            most_impacts : 7
        }
    }
    return myObject ;
}

function getAllRosters(){

    var myObject = {
        message : "success",
        data : {rosters : ["Roster 1", "Roster 2", "Roster 3", "Roster 4"]
    }
}

return myObject ;

}

function addTeam(obj){

    return new Promise((resolve,reject)=>{
        var dbInsert = {
            TableName: "teams",
            Item: obj
        };
        docClient.put(dbInsert, function (err, data) {
            if (err) {
                console.log(err);
                reject(err)

            } else {

                resolve(data)
            }
        });
    })

}

function deleteTeam(obj) {
    console.log("IN delete functionality");
    return new Promise((resolve, reject)=>{
        let params = {
            TableName: "teams",
            Key: {
                "organization": obj.organization,
                "team_name" : obj.team_name
            }
        };
        docClient.delete(params, function(err, data) {
            if (err){
                reject(err)
            }
            else{
                resolve(data)
            }
        });
    })
}

function fetchAllTeamsInOrganization(org){
    return new Promise((resolve,reject)=>{
        let params = {
            TableName: 'teams',
            KeyConditionExpression: "organization = :organization",
            ExpressionAttributeValues: {
                ":organization": org
            }
        };
        var item = [];
        docClient.query(params).eachPage((err, data, done) => {
            if (err) {
                reject(err);
            }
            if (data == null) {
                resolve(concatArrays(item))
            } else {
                item.push(data.Items);
            }
            done();
        });
    })

}

function scanSensorDataTable(){
    return new Promise((resolve,reject)=>{
        let params = {
            TableName: 'sensor_data'
        };
        var item = [];
        docClient.scan(params).eachPage((err, data, done) => {
            if (err) {
                reject(err);
            }
            if (data == null) {
                resolve(concatArrays(item))
            } else {
                item.push(data.Items);
            }
            done();
        });
    })

}

function deleteTeamFromOrganizationList(org, team_name) {
    return new Promise((resolve, reject)=>{
        let params = {
            TableName: "teams",
            Key: {
                "organization": org,
                "team_name" : "teams"
            }
        };
        docClient.get(params, function (err, data) {
            if (err) {
                reject(err)
            }
            else {

                var item = data.Item ;
                var updatedList = item.team_list.filter(function(team) {
                    return team != team_name;
                });
                console.log(updatedList);
                var dbInsert = {
                    TableName: "teams",
                    Key: { "organization" : org,
                    "team_name" : "teams"
                },
                UpdateExpression: "set #list = :newItem ",
                ExpressionAttributeNames: {
                    "#list": "team_list"
                },
                ExpressionAttributeValues: {
                    ":newItem": updatedList
                },
                ReturnValues: "UPDATED_NEW"
            }
            docClient.update(dbInsert, function (err, data) {
                if (err) {
                    console.log("ERROR WHILE DELETING DATA",err);
                    reject(err);

                } else {
                    resolve(data)
                }
            });
        }
    })
})
}

function addTeamToOrganizationList(org, team_name) {
    return new Promise((resolve, reject)=>{
        // if flag is true it means data array is to be created
        let params = {
            TableName: "teams",
            Key: {
                "organization": org,
                "team_name" : "teams"
            }
        };
        docClient.get(params, function (err, data) {
            if (err) {
                reject(err)
            }
            else {
                console.log("DATA IS ADD USER TO ORG ", data);
                if (Object.keys(data).length == 0 && data.constructor === Object) {
                    var dbInsert = {
                        TableName: "teams",
                        Item: { organization : org,
                            team_name : "teams",
                            team_list : [team_name] }
                        };
                        docClient.put(dbInsert, function (err, data) {
                            if (err) {
                                console.log(err);
                                reject(err);

                            } else {
                                resolve(data)
                            }
                        });
                    }
                    else {
                        var dbInsert = {
                            TableName: "teams",
                            Key: { "organization" : org,
                            "team_name" : "teams"
                        },
                        UpdateExpression: "set #list = list_append(#list, :newItem)",
                        ExpressionAttributeNames: {
                            "#list": "team_list"
                        },
                        ExpressionAttributeValues: {
                            ":newItem": [team_name]
                        },
                        ReturnValues: "UPDATED_NEW"
                    }

                    docClient.update(dbInsert, function (err, data) {
                        if (err) {
                            console.log("ERROR WHILE CREATING DATA",err);
                            reject(err);

                        } else {
                            resolve(data)
                        }
                    });
                }
            }
        });
    })
}

function getCumulativeAccelerationData(player_id){
    return new Promise((resolve,reject)=>{
        let params = {
            TableName: 'sensor_data',
            KeyConditionExpression: "player_id = :player_id",
            ExpressionAttributeValues: {
                ":player_id": player_id
            }
        };
        var item = [];
        docClient.query(params).eachPage((err, data, done) => {
            if (err) {
                reject(err);
            }
            if (data == null) {
                resolve(concatArrays(item))
            } else {
                item.push(data.Items);
            }
            done();
        });
    })
}

function getCumulativeSensorData(player_id){
    return new Promise((resolve,reject)=>{
        let params = {
            TableName: 'sensor_data',
            KeyConditionExpression: "player_id = :player_id",
            ExpressionAttributeValues: {
                ":player_id": player_id
            }
        };
        var item = [];
        docClient.query(params).eachPage((err, data, done) => {
            if (err) {
                reject(err);
            }
            if (data == null) {
                resolve(concatArrays(item))
            } else {
                item.push(data.Items);
            }
            done();
        });
    })
}

function customInsertionSortForGraphData(arr , arr1){
    // arr needs to be the Y-AXIS of the graph
    // arr1 is X-AXIS of the graph
    for (var i = 1; i < arr.length; i++)
    {
        if (arr[i] < arr[0])
        {
            //move current element to the first position
            arr.unshift(arr.splice(i,1)[0]);
            arr1.unshift(arr1.splice(i,1)[0]);

        }
        else if (arr[i] > arr[i-1])
        {
            //leave current element where it is
            continue;
        }
        else {
            //find where element should go
            for (var j = 1; j < i; j++) {
                if (arr[i] > arr[j-1] && arr[i] < arr[j])
                {
                    //move element
                    arr.splice(j,0,arr.splice(i,1)[0]);
                    arr1.splice(j,0,arr1.splice(i,1)[0]);
                }
            }
        }
    }
    return {
        array_Y : arr,
        array_X : arr1
    }
}

function getPlayersInList(list){
    var playerMap = new Map();
    for(var i = 0 ; i < list.length ; i++ ){
        // check if key in map exists (Player id)
        // if it doesn't exists then add the array element
        // else update value of alert and impacts in existsing key in map
        if(playerMap.has(list[i].player_id)){

            let tempObject = playerMap.get(list[i].player_id);
            tempObject.impact += list[i].impact ;
            playerMap.set(list[i].player_id,tempObject);
        }
        else{

            playerMap.set(list[i].player_id,list[i]);
        }
    }
    console.log(playerMap.keys());
    return Array.from( playerMap.values() );

}

function indexOfMax(arr) {
    if (arr.length === 0) {
        return -1;
    }

    var max = arr[0];
    var maxIndex = 0;

    for (var i = 1; i < arr.length; i++) {
        if (arr[i] > max) {
            maxIndex = i;
            max = arr[i];
        }
    }

    return maxIndex;
}


// Clearing the cookies
app.get(`/`, (req, res) => {
    res.send("TesT SERVICE HERE");
})

app.post(`${apiPrefix}computeImageData`, setConnectionTimeout('10m'), function(req, res){

    // Get URL Image in input
    // Get User cognito ID in input
    // 1. Generate 3d Avatar
    // 1.1 Set update in DB that selfie model is uploaded
    // 2. Genearte 3d Profile Image from PLY file of 3D Avatar
    // 2.1 Set Update in DB that 3d Profile Png image generated is uploaded
    // 3. Generate INP File
    // 3.1 Set update in DB that inp file is uploaded
    // 4. Do simulation & generate PNG file of it
    // 4.1 Set Update in DB that simulation file is generated

    // Adding timestamp as filename to request
    req.body["file_name"] = Number(Date.now()).toString();
    generate3DModel(req.body)
    .then((data)=>{

        upload3DModelZip(req.body,function(err,data){

            if(err){
                // Create Selfie PNG Image using ProjectedTexture VTK
                // TODO
                res.send({
                    message : "failure",
                    error : err
                })
            }
            else{
                console.log(`xvfb-run ./config/ProjectedTexture ./avatars/${req.body.user_cognito_id}/head/model.ply ./avatars/${req.body.user_cognito_id}/head/model.jpg ./avatars/${req.body.user_cognito_id}/head/${req.body.file_name}.png`);
                executeShellCommands(`xvfb-run ./config/ProjectedTexture ./avatars/${req.body.user_cognito_id}/head/model.ply ./avatars/${req.body.user_cognito_id}/head/model.jpg ./avatars/${req.body.user_cognito_id}/head/${req.body.file_name}.png`)
                .then((data)=>{
                    // Upload the selfie image generated on S3
                    uploadGeneratedSelfieImage(req.body,function(err,data){
                        if(err){
                            res.send({
                                message : "failure",
                                error : err
                            })
                        }
                        else{


                            updateSelfieAndModelStatusInDB(req.body,function(err,data){

                                if(err){
                                    res.send({
                                        message : "failure",
                                        error : err
                                    })

                                }
                                else{
                                    // Generate INP File
                                    generateINP(req.body.user_cognito_id)
                                    .then((d)=>{

                                        // Update Status of INP File generation
                                        updateINPFileStatusInDB(req.body, function(err,data){

                                            if(err){
                                                res.send({
                                                    message : "failure",
                                                    error : er
                                                })

                                            }
                                            else{
                                                // Create Simulation File

                                                generateSimulationFile(req.body.user_cognito_id)
                                                .then((data)=>{

                                                    // Update status of simulation file
                                                    updateSimulationFileStatusInDB(req.body,function(err,data){

                                                        if(err){

                                                            res.send({
                                                                message : "failure",
                                                                error : err
                                                            })

                                                        }
                                                        else{
                                                            res.send({
                                                                message : "success"
                                                            })
                                                        }


                                                    });
                                                })
                                                .catch((err)=>{
                                                    res.send({
                                                        message : "failure",
                                                        error : err
                                                    });
                                                })
                                            }
                                        })


                                    }).catch((err)=>{
                                        console.log(err);
                                        res.send({
                                            message : "failure",
                                            error : err
                                        })
                                    })
                                }
                            })
                        }
                    })
                })
                .catch((err)=>{
                    res.send({
                        message : "failure",
                        error : err
                    })

                })

            }

        })
    })
    .catch((err)=>{
        res.send({
            message : "failure",
            error : err
        })
    })

})

app.post(`${apiPrefix}generateINF`, function(req, res){
    console.log(req.body);
    generateINP(req.body.user_id).then((d)=>{
        res.send({
            message : "success",
            data : d
        })
    }).catch((err)=>{
        console.log(err);
        res.send({
            message : "failure",
            error : err
        })
    })
})
app.post(`${apiPrefix}generateSimulation`, function(req, res){
    console.log(req.body);
    generateSimulationFile(req.body.user_id).then((d)=>{
        res.send({
            message : "success",
            data : d
        })
    }).catch((err)=>{
        console.log(err);
        res.send({
            message : "failure",
            error : err
        })
    })
})

app.post(`${apiPrefix}generateSimulation`, function(req, res){
    console.log(req.body);
    generateSimulationFile(req.body.user_id).then((d)=>{
        res.send({
            message : "success",
            data : d
        })
    }).catch((err)=>{
        console.log(err);
        res.send({
            message : "failure",
            error : err
        })
    })
})


app.post(`${apiPrefix}getCumulativeAccelerationData`, function(req, res){
    console.log(req.body);
    getCumulativeAccelerationData(req.body.player_id)
    .then(data => {
        let linear_accelerations = data.map(function (impact_data) {
            return impact_data.linear_acceleration_pla_
        });

        let angular_accelerations = data.map(function (impact_data) {
            return impact_data.angular_acceleration_paa
        });
        var sorted_acceleration_data = customInsertionSortForGraphData(angular_accelerations, linear_accelerations)
        res.send({
            message : "success",
            data : {
                linear_accelerations : sorted_acceleration_data.array_X,
                angular_accelerations : sorted_acceleration_data.array_Y
            }
        })
    })
    .catch(err => {
        res.send({
            message : "failure",
            data : {
                linear_accelerations : [],
                angular_accelerations : []
            },
            error : err
        })
    })
})



app.post(`${apiPrefix}getPlayersDetails`, function(req, res){
    scanSensorDataTable()
    .then(list => {
        var player_list = [];

        res.send({
            message : "success",
            data : getPlayersInList(list)
        })
    })
    .catch(err => {
        res.send({
            message : "failure",
            error : err
        })
    });
})

app.post(`${apiPrefix}getCumulativeAccelerationTimeData`, function(req, res){

    getCumulativeAccelerationData(req.body.player_id)
    .then(data => {
        let linear_accelerations = data.map(function (impact_data) {
            return impact_data.linear_acceleration_pla_
        });

        // X- Axis Linear Acceleration
        let max_linear_acceleration = Math.max(...linear_accelerations);
        // Y Axis timestamp
        let time = [0,20,40];

        res.send({
            message : "success",
            data : {
                linear_accelerations : [0,max_linear_acceleration,0],
                time : time
            }
        })
    })
    .catch(err => {
        res.send({
            message : "failure",
            data : {
                linear_accelerations : [],
                angular_accelerations : []
            },
            error : err
        })
    })
})


app.post(`${apiPrefix}getCumulativeEventPressureData`, function(req, res){

    res.send(getCumulativeEventPressureData());
})

app.post(`${apiPrefix}getCumulativeEventLoadData`, function(req, res){

    res.send(getCumulativeEventLoadData());
})

app.post(`${apiPrefix}getHeadAccelerationEvents`, function(req, res){

    res.send(getHeadAccelerationEvents());

})

app.post(`${apiPrefix}getTeamAdminData`, function(req, res){

    res.send(getTeamAdminData());

})

app.post(`${apiPrefix}getImpactSummary`, function(req, res){

    res.send(getImpactSummary());

})

app.post(`${apiPrefix}getImpactHistory`, function(req, res){

    res.send(getImpactHistory());

})

app.post(`${apiPrefix}getPlayersData`, function(req, res){

    res.send(getPlayersData());

})

app.post(`${apiPrefix}getOrganizationAdminData`, function(req, res){

    res.send(getOrganizationAdminData());

})

app.post(`${apiPrefix}getAllRosters`, function(req, res){

    res.send(getAllRosters());

})


app.post(`${apiPrefix}getSimulationDataOfPlayer`, function(req, res){
    // GET JSON data
    // PARSE THE DATA IN REQUIRED FORMAT
    // ======================== EXAMPLE FORMAT IS GIVEN =======================
    // {
    // "player": {
    // 	"name": "harry",
    // 	"position": "OL"
    // },
    // "simulation": {
    // 	"mesh": "brain.inp",
    // 	"linear-acceleration": [80.0, 0.0, 0.0],
    // 	"angular-acceleration": 8000.0,
    // 	"time-peak-acceleration": 1.0e-5,
    // 	"maximum-time": 2.0e-5,
    // 	"impact-point": "front-low"
    // }
    // }
    //=========================================================================
    // STORE IT IN TMP filter
    // CALL THE MPIRUN AND EXECUTE
    getCumulativeSensorData(req.body.player_id)
    .then(d => {
        var playerData = {
            "player": {
                "name": "",
                "position": ""
            },
            "simulation": {
                "mesh": "brain.inp",
                "linear-acceleration": [0.0, 0.0, 0.0],
                "angular-acceleration": 0.0,
                "time-peak-acceleration": 1.0e-5,
                "maximum-time": 2.0e-5,
                "impact-point": ""
            }
        }

        let linear_accelerations = d.map(function (impact_data) {
            return impact_data.linear_acceleration_pla_
        });
        // Max Linear Accelearation Impact data
        let index = indexOfMax(linear_accelerations);
        playerData["player"]["name"] = d[index].player_id ;
        playerData["player"]["position"] = d[index].position.toLowerCase() ;
        playerData["simulation"]["linear-acceleration"][0] = d[index].linear_acceleration_pla_ ;
        playerData["simulation"]["angular-acceleration"] = d[index].angular_acceleration_paa ;
        playerData["simulation"]["impact-point"] = d[index].impact_location_on_head.toLowerCase() ;
        // STORE THE ABOVE DATA IN TMP/PLAYERID/TIMESTAMP.json
        // EXECUTE THE MPIRUN COMMAND & EXECUTE THE PVPYTHON MODULE COMMAND
        // GENERATE THE SCREENSHOT PNG AND UPLOAD IT IN S3 BUCKET

        res.send({
            message : "success",
            data : playerData
        })
    })
    .catch(err => {
        res.send({
            message : "failure",
            error  : err
        })
    })


})

app.post(`${apiPrefix}addTeam`, function(req, res){
    addTeam(req.body)
    .then(data => {
        // Adding user to organization
        return new addTeamToOrganizationList(req.body.organization, req.body.team_name)
    })
    .then(d => {
        res.send({
            message : "success"
        })
    })
    .catch(err => {
        res.send({
            message : "failure",
            error : err
        })
    })

})

app.post(`${apiPrefix}fetchAllTeamsInOrganization`, function(req, res){
    console.log(req.body);
    fetchAllTeamsInOrganization(req.body.organization)
    .then(list => {
        var teamList = list.filter(function(team) {

            return (!("team_list" in team));
        });
        res.send({
            message : "success",
            data : teamList
        })
    })
    .catch(err => {
        console.log(err);
        res.send({
            message : "failure",
            error : err
        })
    })

})

app.post(`${apiPrefix}deleteTeam`, function(req, res){
    deleteTeam(req.body)
    .then(d => {
        return new deleteTeamFromOrganizationList(req.body.organization, req.body.team_name)
    })
    .then(d => {
        res.send({
            message : "success"
        })
    })
    .catch(err => {
        res.send({
            message : "failure",
            error : err
        })
    })
})


// Configuring port for APP
const port = 3000;
const server = app.listen(port, function () {
    console.log('Magic happens on ' + port);
});
