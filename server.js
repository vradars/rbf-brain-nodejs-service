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


    // Configuring port for APP
    const port = 3000;
    const server = app.listen(port, function () {
        console.log('Magic happens on ' + port);
    });
