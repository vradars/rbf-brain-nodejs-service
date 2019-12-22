process.title = "NSFCAREER";

// Include the cluster module
const cluster = require('cluster');

// Code to run if we're in the master process
if (cluster.isMaster) {

    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;

    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        cluster.fork();
    }

    // Listen for terminating workers
    cluster.on('exit', function (worker) {

        // Replace the terminated workers
        console.log('Worker ' + worker.id + ' died :(');
        cluster.fork();

    });

    // Code to run if we're in a worker process
} else {



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
execFile = require('child_process').execFile,
conversion = require("phantom-html-to-pdf")(),
XLSX = require('xlsx'),
ejs = require('ejs'),
nodemailer = require('nodemailer'),
jwt = require('jsonwebtoken'),
fs = require('fs'),
shortid = require('shortid'),
moment = require('moment');

var _ = require('lodash');
var simulation_timer = 120000 ; // 4 minutes in milliseconds


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
//
var config = {

    "awsAccessKeyId": process.env.AWSACCESSKEYID,
    "awsSecretAccessKey": process.env.AWSACCESSSECRETKEY,
    "avatar3dClientId": process.env.AVATAR3DCLIENTID,
    "avatar3dclientSecret": process.env.AVATAR3DCLIENTSECRET,
    "region" : process.env.REGION,
    "usersbucket": process.env.USERSBUCKET,
    "apiVersion" : process.env.APIVERSION,
    "jwt_secret" : process.env.JWTSECRET,
    "email_id" : process.env.EMAILID,
    "mail_list" : process.env.MAILLIST,
    "ComputeInstanceEndpoint" : process.env.COMPUTEINSTANCEENDPOINT,
    "userPoolId": process.env.USERPOOLID,
    "ClientId" : process.env.CLIENTID,
    "react_website_url" : process.env.REACTURL,
    "simulation_result_host_url" : process.env.SIMULATION_RESULT_HOST_URL
};

const subject_signature  = fs.readFileSync("data/base64")

var config_env = config ;
// var config = require('./config/configuration_keys.json');
// var config_env = config;

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

// NODEMAILER CONFIGURATION
var email = config_env.email_id ;
let transport = nodemailer.createTransport({
    SES: new AWS.SES({ apiVersion: "2010-12-01" })
})
console.log(email, config_env.email_id_password);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ===========================================
//     UTILITY FUNCTIONS
// ===========================================

function concatArrays(arrays) {
    return [].concat.apply([], arrays);
}

// Promise to delay a function or any promise
const delay = t => new Promise(resolve => setTimeout(resolve, t));

// ======================================
//              FUNCTIONS
// ======================================

function getUserDetails(user_name, cb) {
    return new Promise((resolve, reject) =>{
        var db_table = {
            TableName: 'users',
            Key: {
                "user_cognito_id": user_name
            }
        };
        docClient.get(db_table, function (err, data) {
            if (err) {

                reject(err)

            } else {

                resolve(data);
            }
        });
    })
}



function sendMail(recepient, subject, body, attachement_name = null, attachment = null ) {
    console.log("Mail is being sent to ", recepient, " by ", email) ;
    return new Promise((resolve, reject) =>{

        console.log(email);
        var message = {
            from : email,
            to : recepient,
            subject : subject,
            priority : 'high'
        }
        if(body.includes('html'))
        {
            message["html"] = body ;
        }
        else{
            message["text"] = body ;
        }

        if(attachment != null){
            message["attachments"] = {
                filename : attachement_name,
                path : attachment,
                cid : "IRB"
            }
        }

        transport.sendMail(message,(err,info) =>{

            if(err){
                reject(err)
                console.log("error while sending mail", err);
            }
            else{
                console.log('success while sending mail')
                resolve({
                    status : "success",
                    log : `Mail sent `
                })
            }
        })
    })
}

function generateJWToken(obj,expiry){
    return new Promise((resolve, reject) =>{
        console.log("THE VALUES IS ", config_env.jwt_secret);
        jwt.sign(obj, config_env.jwt_secret, { expiresIn: expiry }, (err,token)=> {
            if(err){
                reject(err);
            }
            else{
                resolve(token);
            }
        })
    })
}

function generateJWTokenWithNoExpiry(obj, secret){
    return new Promise((resolve, reject) =>{
        console.log("THE VALUES IS ", config_env.jwt_secret);
        jwt.sign(obj, secret, (err,token)=> {
            if(err){
                reject(err);
            }
            else{
                resolve(token);
            }
        })
    })
}

function verifyToken(token){
    return new Promise((resolve, reject) =>{
        jwt.verify(token, config_env.jwt_secret, (err,decoded)=> {
            if(err){
                console.log(err);
                reject(err);
            }
            else{
                resolve(decoded);
            }
        })
    })
}

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


function uploadVTKFile(user_id,timestamp,cb){


    var uploadParams = {
        Bucket: config.usersbucket,
        Key: '', // pass key
        Body: null, // pass file body
    };

    const params = uploadParams;

    fs.readFile(`../users_data/${user_id}/rbf/${timestamp}.vtk`, function (err, headBuffer) {
        if (err) {
            cb(err,'');
        }
        else {
            params.Key = user_id + "/profile/rbf/vtk/" + timestamp + ".vtk";
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

    fs.readFile(`/home/ec2-user/FemTech/build/examples/ex5/${user_id}-${timestamp}.png`, function (err, headBuffer) {
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
        var cmd = `cd /home/ec2-user/FemTech/build/examples/ex5;mpirun --allow-run-as-root -np 2  --mca btl_base_warn_component_unused 0  -mca btl_vader_single_copy_mechanism none ex5 input.json`
        console.log(cmd);
        executeShellCommands(cmd).then((data)=>{

            // Doing Post Processing on simulation
            var timestamp = Date.now();

            cmd = `cd /home/ec2-user/FemTech/build/examples/ex5; ~/MergePolyData/build/MultipleViewPorts brain3.ply Br_color3.jpg maxstrain.dat ${user_id}-${timestamp}.png`;
            console.log(cmd);
            executeShellCommands(cmd).then((data)=>{
                uploadSimulationFile(user_id,timestamp,(err,data)=>{
                    if(err){
                        console.log(err);
                        reject(err);
                    }
                    else{

                        resolve(data);

                    }
                })

            })
            .catch((error)=>{
                console.log(err);
                reject(error);
            })

        }).catch((error)=>{
            console.log(err);
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
                                                uploadVTKFile(user_id, timestamp, (err, data)=>{

                                                    if(err){

                                                        reject(err);
                                                    }
                                                    else{
                                                        resolve(data);
                                                    }
                                                })
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


function updateSimulationFileStatusInDB(obj){
    return new Promise((resolve,reject)=>{
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
                reject(err);
            } else {
                resolve(data);
            }
        })
    });

}


function updateIRBFormStatusInDDB(obj,cb){
    var userParams = {
        TableName: "users",
        Key: {
            "user_cognito_id": obj.user_cognito_id
        },
        UpdateExpression: "set is_IRB_complete = :is_IRB_complete",
        ExpressionAttributeValues: {
            ":is_IRB_complete" : true
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

function getHeadAccelerationEvents(obj){
    return new Promise((resolve,reject)=>{
        let params = {
            TableName: 'sensor_data',
            KeyConditionExpression: "team = :team and begins_with(player_id, :player_id)",
            ExpressionAttributeValues: {
                ":team": obj.team,
                ":player_id" : obj.player_id
            }
        };
        var item = [];
        docClient.query(params).eachPage((err, data, done) => {
            if (err) {
                console.log(err);
                reject(err);
            }
            if (data == null) {
                let records = concatArrays(item);
                let date = records.map(function (record) {
                    return record.date ;
                });
                // Now we will store no of impacts corresponding to date
                var date_map = new Map();
                for(var i = 0 ; i < date.length ; i++ ){
                    // check if key in map exists (Player id)
                    // if it doesn't exists then add the array element
                    // else update value of alert and impacts in existsing key in map
                    if(date_map.has(date[i])){

                        let tempObject = date_map.get(date[i]);
                        tempObject += 1 ;
                        date_map.set(date[i],tempObject);
                    }
                    else{

                        date_map.set(date[i], 0 );
                    }
                }
                console.log("DATE MAP",date_map.keys());
                console.log(Array.from( date_map.values() ));


                resolve({
                    no_of_impacts : Array.from( date_map.values() ),
                    dates : Array.from( date_map.keys() ),
                    timestamp : Number(Date.now()).toString()
                });
            } else {
                item.push(data.Items);
            }
            done();
        });
    })
    // var myObject = {
    //     message : "success",
    //     data : {
    //         pressure : [176, 267, 187, 201, 180, 4, 230, 258, 14, 21, 89, 23, 119, 113, 28, 49],
    //         time_label : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75],
    //         timestamp : Number(Date.now()).toString()
    //     }
    // }
    // return myObject;

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

function getCumulativeAccelerationData(obj){
    return new Promise((resolve,reject)=>{
        let params = {
            TableName: 'sensor_data',
            KeyConditionExpression: "team = :team and begins_with(player_id,:player_id)",
            ExpressionAttributeValues: {
                ":player_id": obj.player_id,
                ":team" : obj.team
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

function getTeamDataWithPlayerRecords(obj){
    return new Promise((resolve,reject)=>{
        let params = {
            TableName: 'sensor_data',
            KeyConditionExpression: "team = :team and begins_with(player_id,:player_id)",
            ExpressionAttributeValues: {
                ":player_id": obj.player_id,
                ":team" : obj.team
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

function getTeamData(obj){
    return new Promise((resolve,reject)=>{
        let params = {
            TableName: 'sensor_data',
            KeyConditionExpression: "team = :team",
            ExpressionAttributeValues: {
                ":team" : obj.team
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

function getCumulativeSensorData(obj){
    return new Promise((resolve,reject)=>{
        let params = {
            TableName: 'sensor_data',
            KeyConditionExpression: "team = :team and begins_with(player_id,:player_id)",
            ExpressionAttributeValues: {
                ":team": obj.team,
                ":player_id" : obj.player_id
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
function writeJsonToFile(path, jsonObject){

    return new Promise((resolve, reject) => {
        fs.writeFile(path, JSON.stringify(jsonObject), (err) => {
            if (err) {
                reject(err);
            }
            else{
                resolve(true);
            }
        });
    })
}
function uploadPlayerSimulationFile(user_id, file_path, file_name, date, image_id=null){

    return new Promise((resolve, reject)=>{
        var uploadParams = {
            Bucket: config.usersbucket,
            Key: '', // pass key
            Body: null, // pass file body
        };

        const params = uploadParams;

        fs.readFile(file_path, function (err, headBuffer) {
            if (err) {
                console.log("ERROR in Reading",err);
                reject(err);
            }
            else {
                updateSimulationImageToDDB(image_id, config.usersbucket, user_id + `/simulation/${date}/` + file_name)
                .then(value => {

                    params.Key = user_id + `/simulation/${date}/` + file_name ;
                    params.Body = headBuffer;
                    // Call S3 Upload
                    s3.upload(params, (err, data) => {
                        if (err) {
                            console.log("ERROR IN S3",err);
                            reject(err);
                        }
                        else {
                            // TODO -> Write the buffer to Image BASE64 & Update it in DB
                            resolve(data)
                        }
                    });
                })
                .catch(err => {
                    console.log("Error in reading",err);
                    reject(data);
                })
            }
        })
    })
}

function uploadIRBForm(user_id, file_path, file_name){

    return new Promise((resolve, reject)=>{
        var uploadParams = {
            Bucket: config.usersbucket,
            Key: '', // pass key
            Body: null, // pass file body
        };

        const params = uploadParams;

        fs.readFile(file_path, function (err, headBuffer) {
            if (err) {
                reject(err);
            }
            else {
                params.Key = user_id + `/irb/` + file_name ;
                params.Body = headBuffer;
                // Call S3 Upload
                s3.upload(params, (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(data);
                    }
                });

            }
        })
    })
}

function parseDate(date, arg, timezone) {
    // var result = 0, arr = arg.split(':')

    arg = arg.replace(".",":");
    var t = arg.split(":");
    var milliseconds ;
    var time_type ;
    milliseconds = t[3].split(" ")[0];
    // x stores parsed time format
    var x = "";
    if(t[3].indexOf('P') > -1){
        x = `${t[0]}:${t[1]}:${t[2]} ${t[3].split(" ")[1]}`
    }
    return moment.utc(date  + " , " +   x , 'MM/DD/YYYY , hh:mm:ss a', true).milliseconds(Number(milliseconds)).valueOf();
}

function convertXLSXDataToJSON(buf,cb){
    // york_data.xlsx

    var wb = XLSX.read(buf, {type:'buffer'});
    var sheet_name_list = wb.SheetNames;
    sheet_name_list.forEach(function(y) {
        var worksheet = wb.Sheets[y];
        var headers = {};
        var data = [];
        for(z in worksheet) {
            if(z[0] === '!') continue;
            //parse out the column, row, and value
            var col = z.substring(0,1);
            var row = parseInt(z.substring(1));
            var value = worksheet[z].v;

            //store header names
            if(row == 1) {

                if(value == "Athlete"){
                    value = "player_id"
                }
                headers[col] = value
                .split(" ")
                .join("_")
                .replace(/[{()}]/g, '')
                .toLowerCase();
                continue;
            }

            if(!data[row]) data[row]={};

            data[row][headers[col]] = value;



        }
        //drop those first two rows which are empty
        data.shift();
        data.shift();
        var data_array = data.filter(function(el) {
            return el.false_positive == false;
        });
        console.log("The impact data found is ", data_array.length);
        for(var i = 0 ; i < data_array.length ; i++){
            var d = data_array[i];
            // TODO : Parse Date here
            data_array[i]["timestamp"] = Number(parseDate(d.date, d.time, d.time_zone)).toString();
            data_array[i]["simulation_status"] = "pending";
            data_array[i].player_id = data_array[i].player_id + "$" + data_array[i].timestamp;
        }
        cb(data_array);
    });

}

function storeSensorData(sensor_data_array){
    return new Promise((resolve, reject) =>{
        var counter = 0 ;
        if(sensor_data_array.length == 0 ){
            resolve(true);
        }
        for(var i = 0 ; i < sensor_data_array.length ; i++){

            let param = {
                TableName: "sensor_data",
                Item: sensor_data_array[i]
            };
            docClient.put(param, function (err, data) {
                counter++;
                if (err) {
                    console.log(err);
                    reject(err)
                }
                if(counter == sensor_data_array.length){
                    resolve(true);
                }
            })
        }
    })
}

function updateSimulationImageToDDB(image_id, bucket_name, path, status = "completed", token = null, secret = null){
    return new Promise((resolve, reject) => {
        if(image_id == null){
            return resolve({ message : "No Image Simulation ID provided"});
        }
        else{
// if flag is true it means data array is to be created
        let params = {
            TableName: "simulation_images",
            Key: {
                "image_id": image_id
            }
        };
        docClient.get(params, function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                if (Object.keys(data).length == 0 && data.constructor === Object) {
                    var dbInsert = {
                        TableName: "simulation_images",
                        Item: { image_id : image_id,
                                bucket_name : bucket_name,
                                path : path,
                                status : status,
                                token : token,
                                secret : secret
                                }
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
                        // If Player does not exists in Team
                            var dbInsert = {
                                TableName: "simulation_images",
                                Key: { "image_id" : image_id},
                            UpdateExpression: "set #path = :path,#status = :status",
                            ExpressionAttributeNames: {
                                "#path": "path",
                                "#status": "status",
                            },
                            ExpressionAttributeValues: {
                                ":path": path,
                                ":status": status
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

        }
        })
    }

    function addPlayerToTeamInDDB(org, team, player_id) {
        return new Promise((resolve, reject)=>{
            // if flag is true it means data array is to be created
            let params = {
                TableName: "teams",
                Key: {
                    "organization": org,
                    "team_name" : team
                }
            };
            docClient.get(params, function (err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    if (Object.keys(data).length == 0 && data.constructor === Object) {
                        var dbInsert = {
                            TableName: "teams",
                            Item: { organization : org,
                                team_name : team,
                                player_list : [player_id] }
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
                            // If Player does not exists in Team
                            if(data.Item.player_list.indexOf(player_id) <= -1){
                                var dbInsert = {
                                    TableName: "teams",
                                    Key: { "organization" : org,
                                    "team_name" : team
                                },
                                UpdateExpression: "set #list = list_append(#list, :newItem)",
                                ExpressionAttributeNames: {
                                    "#list": "player_list"
                                },
                                ExpressionAttributeValues: {
                                    ":newItem": [player_id]
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
                        else{
                            resolve("PLAYER ALREADY EXISTS IN TEAM");
                        }

                    }
                }
            });


        })
    }

    function base64_encode(file) {

        // read binary data
        let bitmap = fs.readFileSync(file);

        // convert binary data to base64 encoded string
        return new Buffer(bitmap).toString('base64');
    }

    // Clearing the cookies
    app.get(`/`, (req, res) => {
        res.send("TesT SERVICE HERE");
    })

    app.post(`${apiPrefix}generateSimulationForSensorData`,setConnectionTimeout('10m'), function(req, res) {

        // The file content will be in 'upload_file' parameter
        let buffer = Buffer.from(req.body.upload_file, 'base64');

        // TODO : upload file in s3 ( Which bucket ? )

        // Converting xlsx file data into JSON
        convertXLSXDataToJSON(buffer, function(items) {


            items.map((element) => {
                return element.organization = "PSU";
            });

            const new_items_array = _.map(items, o => _.extend({organization: "PSU"}, o));
            for(var i = 0 ; i < new_items_array.length ; i++){
                var _temp = new_items_array[i] ;
                _temp["image_id"] = shortid.generate() ;
                new_items_array[i] = _temp ;
            }

            storeSensorData(new_items_array)
            .then(flag => {

                var players = items.map(function (player) {
                    return {    player_id : player.player_id.split("$")[0],
                    team : player.team,
                    organization : player.organization,
                }
            });

            var unique_players = _.uniq(players, 'player_id');
            const result = [];
            const map = new Map();
            var simulation_result_urls = [];
            for (const item of players) {
                if(!map.has(item.player_id)){
                    map.set(item.player_id, true);    // set any value to Map
                    result.push(item);
                }
            }
            if(result.length == 0){
                res.send({
                    message : "success"
                })
            }
            else{
                // Run simulation here and send data
                // {
                //     "player_id" : "STRING",
                //     "team" : "STRING",
                //     "organization" : "STRING"
                // }
                var counter = 0 ;
                console.log("UNIQUE PLAYERS ++++++++++++++ ",result);

                for(var i =0 ; i< result.length ; i++){
                    var temp = result[i];
                    console.log("SIMULATION RUNNING FOR ,",temp);

                    addPlayerToTeamInDDB(temp.organization, temp.team, temp.player_id)
                    .then(d => {
                        // Generate simulation for player
                        getCumulativeSensorData(temp)
                        .then(player_data_array => {
                          console.log("Player records fetched are :", player_data_array);

                            if(player_data_array.length == 0 ){

                                counter++;
                                if(counter == result.length){
                                    res.send({
                                                message : "success",
                                                image_url : simulation_result_urls
                                            })
                                }
                            }
                            else{
                                generateSimulationForPlayers(player_data_array)
                                .then(urls => {
                                        console.log(simulation_result_urls);
                                        console.log("URLS RECEIVED IS",urls);
                                        simulation_result_urls.push(urls)
                                        counter++;
                                        if(counter == result.length){
                                            res.send({
                                                        message : "success",
                                                        image_url : _.spread(_.union)(simulation_result_urls)
                                                    })
                                        }
                                })
                                .catch(err => {
                                    counter = result.length ;
                                    i = result.length ;
                                    res.send({
                                        message : "failure",
                                        error : err
                                    })
                                })
                            }
                        }).
                        catch(err => {
                            console.log('ERROR');
                            counter = result.length ;
                            i = result.length ;
                            res.send({
                                message : "failure",
                                error : err
                            })
                        })
                    })
                    .catch(err => {
                        counter = result.length ;
                        i = result.length ;
                        res.send({
                            message : "failure",
                            error : err
                        })
                    })
                }
            }
        })
    })
})




app.post(`${apiPrefix}getUserDetailsForIRB`, function(req, res){
    console.log(req.body);
    verifyToken(req.body.consent_token)
    .then(decoded_token => {
        console.log(decoded_token);
        getUserDetails(decoded_token.user_cognito_id)
        .then(data => {
            console.log(data);
            res.send({
                message : "success",
                data : data
            })
        })
        .catch(err => {
            res.send({
                message : "failure",
                err : err
            })
        })
    })
    .catch(err => {
        res.send({
            message : "failure",
            err : err
        })
    })
})

app.post(`${apiPrefix}IRBFormGenerate`, function(req, res){
    // console.log(req.body);
    var { user_cognito_id, age } =  req.body ;
    req.body["subject_signature"] = subject_signature
    let date_details = new Date().toJSON().slice(0,10).split('-').reverse()
    req.body["date"] = date_details[1] + "/" + date_details[0] + "/" + date_details[2]
    ejs.renderFile(__dirname + '/views/IRBTemplate.ejs', {user_data : req.body }, {}, function (err, str) {
        // str => Rendered HTML string
        if(err){
            console.log(JSON.stringify(err))
            res.send({
                message : 'failure',
                error : err
            })
        } else {
            conversion({ html: str,
                paperSize: {
                    format: 'A4'
                } }, function(err, pdf) {

                    // Gives the path of the actual stream
                    // console.log(pdf.stream.path);
                    uploadIRBForm(user_cognito_id, pdf.stream.path, `${user_cognito_id}_${Number(Date.now()).toString()}.pdf`)
                    .then(response => {
                        // Updating the IRB Form Status in DDB Record of User
                        console.log(response);
                        return updateSimulationFileStatusInDB({ user_cognito_id : user_cognito_id})

                    })
                    .then(response => {
                        // Send mail here
                        console.log(response);
                        return generateJWToken({user_cognito_id : user_cognito_id}, "365d")

                    })
                    .then(token => {
                        console.log(token);
                        console.log("age now is ", age);
                        console.log("Request.body.age is ", req.body.age);

                        if(req.body.isIRBComplete == true) {

                            // Send IRB form completion mail of minor

                            // subject
                            let subject = `NSFCAREER IRB :\n ${req.body.first_name} ${req.body.last_name}`

                            // link
                            let link = ` ${req.body.first_name} ${req.body.last_name} signed up. IRB Form of Minor Complete `
                            console.log( 'Sending mail');

                            // Send mail
                            return sendMail(config_env.mail_list, subject, link, "IRB_CONSENT.pdf" , pdf.stream.path )

                        } else {

                            if( age > 18 ) {

                                // subject
                                let subject = `NSFCAREER IRB :\n ${req.body.first_name} ${req.body.last_name}`

                                // link
                                let link = ` ${req.body.first_name} ${req.body.last_name} signed up `
                                console.log( 'Sending mail');

                                // Send mail
                                return sendMail(config_env.mail_list, subject, link, "IRB_CONSENT.pdf" , pdf.stream.path )

                            } else {

                                // Send consent form link to guardian
                                let link = `Please click on the below provided link to confirm minor's account :\n ${config_env.react_website_url}IRBParentConsent?key=${token}`;
                                ejs.renderFile(__dirname + '/views/ConfirmMinorAccount.ejs', {data : {url : `${config_env.react_website_url}IRBParentConsent?key=${token}`} }, {}, function (err, str) {
                                    if(err){
                                        res.send({
                                            message  : "failure",
                                            error : err
                                        })
                                    }
                                    else{

                                        sendMail(req.body.guardian_mail, "IRB FORM CONSENT APPLICATION", str, "IRB_CONSENT.pdf",  pdf.stream.path)
                                        .then(response => {
                                            res.send({
                                                message : "success",
                                                data : response
                                            })
                                        })
                                        .catch(err => {
                                            res.send({
                                                message : "failure",
                                                data : err
                                            })
                                        })
                                    }
                                })
                            }

                        }

                    })
                    .then(response => {
                        res.send({
                            message : "success",
                            data : response
                        })
                    })
                    .catch(err => {
                        console.log(err);
                        res.send({
                            message : "failure",
                            data : err
                        })
                    })

                });
            }



        });

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
                    executeShellCommands(`xvfb-run ./../MergePolyData/build/ImageCapture ./avatars/${req.body.user_cognito_id}/head/model.ply ./avatars/${req.body.user_cognito_id}/head/model.jpg ./avatars/${req.body.user_cognito_id}/head/${req.body.file_name}.png`)
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

                                                    //generateSimulationFile(req.body.user_cognito_id)
                                                    //.then((data)=>{

                                                    // Update status of simulation file
                                                    //  return updateSimulationFileStatusInDB(req.body)

                                                    //}).then((data) => {

                                                    res.send({
                                                        message : "success"
                                                    })

                                                    //}).catch((err)=>{
                                                    //   res.send({
                                                    //       message : "failure",
                                                    //       error : err
                                                    //   });
                                                    // })
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

    app.post(`${apiPrefix}getSimulationStatusCount`, function(req, res){
        console.log(req.body);

        getTeamData(req.body)
        .then(simulation_records => {



            res.send({
                message : "success",
                data : {
                    completed : simulation_records.length,
                    failed : 0,
                    pending : 0
                }
            })

        })
        .catch(err => {
            res.send({
                message : "failure",
                error : err,
                data : {
                    completed : 0,
                    failed : 0,
                    pending : 0
                }
            })
        })
    })

    app.post(`${apiPrefix}getCumulativeAccelerationData`, function(req, res){
        console.log(req.body);
        getCumulativeAccelerationData(req.body)
        .then(data => {
            let linear_accelerations = data.map(function (impact_data) {
                return impact_data.linear_acceleration_pla
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
        console.log("Get Player details called",req.body);
        getPlayersListFromTeamsDB(req.body)
        .then(data => {
            console.log(data.player_list);
            if(data.player_list.length == 0 ){
                res.send({
                    message : "success",
                    data : []
                })
            }
            else{
                var counter = 0 ;
                var p_data = [] ;
                data.player_list.forEach(function(player,index){
                    let p = player ;
                    let i = index ;
                    getTeamDataWithPlayerRecords({player_id : p, team : req.body.team_name})
                    .then(player_data => {
                        counter++;
                        p_data.push({player_name : p ,
                            simulation_data : player_data});

                            if(counter ==  data.player_list.length){
                                res.send({
                                    message : "success",
                                    data : p_data
                                })
                            }
                        })
                        .catch(err => {
                            console.log(err);
                            counter++;
                            if(counter ==  data.player_list.length){
                                res.send({
                                    message : "failure",
                                    data : p_data
                                })
                            }
                        })
                    })
                }
            })
            .catch(err => {
                console.log(err);
                res.send({
                    message : "failure",
                    error : err
                })
            });
        })

        app.post(`${apiPrefix}getCumulativeAccelerationTimeData`, function(req, res){

            getCumulativeAccelerationData(req.body)
            .then(data => {
                let linear_accelerations = data.map(function (impact_data) {
                    return impact_data.linear_acceleration_pla
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
                        time : []
                    },
                    error : err
                })
            })
        })

        app.post(`${apiPrefix}getAllCumulativeAccelerationTimeRecords`, function(req, res){

            getCumulativeAccelerationData(req.body)
            .then(data => {
                var acceleration_data_list = [];
                data.forEach(function(acc_data){

                    // X- Axis Linear Acceleration
                    let max_acceleration = [ 0, acc_data.linear_acceleration_pla, 0 ];
                    // Y Axis timestamp
                    let time = [0,20,40];
                    acceleration_data_list.push({
                        max_linear_acceleration : max_acceleration,
                        time : time,
                        timestamp : acc_data.timestamp,
                        record_time : acc_data.time
                    })
                })


                res.send({
                    message : "success",
                    data : acceleration_data_list
                })
            })
            .catch(err => {
                res.send({
                    message : "failure",
                    data : {
                        linear_accelerations : [],
                        time : []
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
            console.log(req.body);
            getHeadAccelerationEvents(req.body)
            .then(data => {
                res.send({
                    message : "success",
                    data : data
                })
            })
            .catch(err => {
                console.log("========================>,ERRROR ,", err);
                res.send({
                    message : "failure",
                    error : err
                });
            })


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

        function getPlayersListFromTeamsDB(obj){
            return new Promise((resolve, reject)=>{
                var db_table = {
                    TableName: 'teams',
                    Key: {
                        "organization": obj.organization,
                        "team_name" : obj.team_name
                    }
                };
                docClient.get(db_table, function (err, data) {
                    if (err) {

                        reject(err)

                    } else {

                        resolve(data.Item)
                    }
                });
            })
        }

        app.post(`${apiPrefix}getPlayersData`, function(req, res){

            res.send(getPlayersData());

        })

        app.post(`${apiPrefix}getOrganizationAdminData`, function(req, res){

            res.send(getOrganizationAdminData());

        })

        app.post(`${apiPrefix}getAllRosters`, function(req, res){

            res.send(getAllRosters());

        })


        app.post(`${apiPrefix}getUpdatesAndNotifications`, (req, res) => {
            var subject = `${req.body.first_name} ${req.body.last_name} subscribed for updates`;
            ejs.renderFile(__dirname + '/views/UpdateTemplate.ejs', {data : req.body }, {}, function (err, str) {
                if(err){
                    res.send({
                        message : "failure",
                        error : err
                    })
                }
                else{
                    sendMail(config_env.mail_list, subject, str)
                    .then(response => {
                        //  Send the mail to User who registered for updates...
                        ejs.renderFile(__dirname + '/views/AdminRespondUpdateTemplate.ejs', {data : req.body }, {}, function (err, str) {
                            if(err){
                                res.send({
                                    message : "failure",
                                    error : err
                                })
                            }
                            else{
                                subject = "NSFCAREER.IO | Thank you for subscribing !";
                                sendMail(req.body.email, subject, str)
                                .then(response => {
                                    res.send({
                                        message : "success",
                                        data : response
                                    })
                                })
                                .catch(err => {
                                    res.send({
                                        message : "failure",
                                        error : err
                                    })
                                })
                            }
                        })

                    })
                    .catch(err => {
                        res.send({
                            message : "failure",
                            error : err
                        })
                    })
                }
            })
        })

        function generateSimulationForPlayers(player_data_array){
            return new Promise((resolve, reject) => {
                var counter = 0 ;
                var simulation_result_urls = [];

                console.log("DATA _--------------------->>>>>>>>>>>>>>>>>>>>>>>",player_data_array);

                player_data_array.forEach(( player,j ) => {

                    var _temp_player = player;
                    var index = j ;
                    var token_secret = shortid.generate();
                    generateJWTokenWithNoExpiry({ image_id : _temp_player.image_id }, token_secret)
                    .then( image_token => {
                         
                  updateSimulationImageToDDB(_temp_player.image_id, config.usersbucket, "null", "pending", image_token, token_secret)
                    .then(value => {
                        console.log("LOOPING THROUGH COMPONENTS ++++++++++ !!!!! ",index ,_temp_player);

                      simulation_result_urls.push(`${config_env.simulation_result_host_url}simulation/results/${image_token}/${_temp_player.image_id}`)
                        setTimeout(generateSimulationForPlayer, simulation_timer, _temp_player, index, _temp_player.image_id, image_token, token_secret);                           
//                        generateSimulationForPlayer(_temp_player, index, _temp_player.image_id)
//                        .then(value =>{
//                                console.log(value);
//                        })
//                      .catch(err => {
//                                console.log(err);
//                      })

                            counter++;

                        if(counter == player_data_array.length){
                            resolve(simulation_result_urls)
                        }
                        // .then(d => {
                        //     console.log('COUNTER IS ', counter +1 );
                        //     inner_counter++;
                        //     image_array.push(d.base64)
                        //     console.log('generateSimulationForPlayer' ,d);
                        //     if(counter == player_data_array.length){
                        //         res.send({
                        //             message : "success",
                        //             images : image_array
                        //         })
                        //     }
                        // })
                        // .catch( err => {
                        //     console.log('ERROR IN GENERATE SIMULATION IMAGE ', err);
                        // })
                    })
                    .catch(err => {
                      console.log("In error", err);
                        counter = result.length ;
                        j = player_data_array.length ;
                        reject(err)
                    })
                    })
                    .catch( err => {
                      
                      console.log("In error", err);
                        counter = result.length ;
                        j = player_data_array.length ;
                        reject(err)
                    })
                })
            })
        }

        function generateSimulationForPlayer(obj, index, image_id = null, token = null, token_secret = null){
            return new Promise((resolve, reject)=>{
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

                // Max Linear Accelearation Impact data

                playerData["player"]["name"] = obj.player_id ;
                playerData["player"]["position"] = obj.position.toLowerCase() ;
                playerData["simulation"]["linear-acceleration"][0] = obj.linear_acceleration_pla ;
                playerData["simulation"]["angular-acceleration"] = obj.angular_acceleration_paa ;
                playerData["simulation"]["impact-point"] = obj.impact_location_on_head.toLowerCase() ;
                console.log("PLAYER DATA PARSED IS ", playerData);
                let p_id = obj.player_id.split("$")[0].split(" ").join("-");
                let file_path = `/tmp/${p_id}/`;
                let timestamp = Number(Date.now()).toString();
                let file_name = `${timestamp}.json`;
                executeShellCommands(`mkdir -p ${file_path}`)
                .then(d => {

                    // STORE THE ABOVE DATA IN TMP/PLAYERID/TIMESTAMP.json
                    return writeJsonToFile(file_path + file_name, playerData)

                })
                .then(d =>{

                    // EXECUTE THE MPIRUN COMMAND
                    let cmd = `cd /home/ec2-user/FemTech/build/examples/ex5;mpirun --allow-run-as-root -np 2  --mca btl_base_warn_component_unused 0  -mca btl_vader_single_copy_mechanism none ex5 ${file_path}${file_name}`
                    console.log(cmd);
                    return executeShellCommands(cmd)

                })
                .then(d =>{

                    // EXECUTE MERGEPOLYDATA PNG
                    let cmd = `cd /home/ec2-user/FemTech/build/examples/ex5; ~/MergePolyData/build/MultipleViewPorts brain3.ply Br_color3.jpg maxstrain.dat ${ p_id + obj.date.split("/").join("-") + "_" + index }.png`
                    return executeShellCommands(cmd)

                })
                .then(d =>{
                    // Upload the file on S3 bucket
                    console.log("IMAGE ID IS ", image_id);
                    let simulationFilePath = `/home/ec2-user/FemTech/build/examples/ex5/${  p_id + obj.date.split("/").join("-") + "_" + index  }.png`
                    return uploadPlayerSimulationFile(obj.player_id.split("$")[0].split(" ").join("-"), simulationFilePath, `${  p_id + obj.date.split("/").join("-") + "_" + index  }.png`, obj.date.split("/").join("-"), image_id)

                })
                .then(d =>{
                    console.log("+++++++++++++++++++++ is ******** \n",d);
                    let simulationFilePath = `/home/ec2-user/FemTech/build/examples/ex5/${  p_id + obj.date.split("/").join("-") + "_" + index  }.png`

                    resolve({
                        message : "success",
                        data  : d
                    })
                })
                .catch(err => {
                    console.log("In 1st Error",err);
                    reject({
                        message : "failure",
                        error : err
                    });
                })
            })

        }

        app.post(`${apiPrefix}generateSimulationForPlayer`, function(req, res){
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
            getCumulativeSensorData(req.body)
            .then(player_data_array => {
                if(player_data_array.length == 0 ){
                    res.send({message : "success"})
                }
                else{
                    var counter = 0 ;
                    try {
                        for(var i = 0 ; i < player_data_array.length ; i++){
                            var temp = player_data_array[i];
                            var index = i ;
                            generateSimulationForPlayer(temp, index)
                            .then(d => {
                                counter++;
                                if(counter == player_data_array.length){
                                    res.send({
                                        message : "success"
                                    })
                                }
                            })
                            .catch(err => {
                                res.send({
                                    message : "failure",
                                    error : err
                                })
                            })
                        }
                    } catch (e) {
                        res.send({
                            message : "failure",
                            error : e
                        })
                    }

                }
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
                let counter = 0 ;
                if( teamList.length == 0 ){
                    res.send({
                        message : "success",
                        data : []
                    })
                }
                else{
                    teamList.forEach(function(team,index){
                        let data = team ;
                        let i = index ;
                        getTeamData({team : data.team_name})
                        .then(simulation_records => {
                            counter++;
                            team["simulation_count"] = Number(simulation_records.length).toString();

                            if(counter == teamList.length){
                                res.send({
                                    message : "success",
                                    data : teamList
                                })
                            }
                        })
                        .catch(err => {
                            counter++
                            if(counter == teamList.length){
                                res.send({
                                    message : "failure",
                                    error : err
                                })
                            }
                        })
                    })
                }
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
}
