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
    config_env = require("./config/configuration_keys"),
    {spawn} = require('child_process'),
    multer = require('multer'),
    download = require('download-file');


// ================================================
//            SERVER CONFIGURATION
// ================================================


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

var config = require("./config/configuration_keys");

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

const awsWorker = require('./controllers/aws.controller.js');
var s3 = new AWS.S3();

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





// Clearing the cookies
app.get(`/`, (req, res) => {
       	res.send("TesT SERVICE HERE");
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


