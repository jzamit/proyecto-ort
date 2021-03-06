var User = require('mongoose').model('User'),
    config = require('../../config/config'),
    mongoose = require('mongoose'),
    jwt = require('jwt-simple'),
    moment = require('moment'),
    deepcopy = require("deepcopy"),
    promise = require('bluebird'),
    Exercise = require('mongoose').model('Exercise'),
    Objective = require('mongoose').model('Objective');
promise.promisifyAll(mongoose);

var events = require('events');
var eventEmitter = new events.EventEmitter();
var request;
var response;
var nextJorge;
var ejercicios = {};
var objective = {};
var userId;


var guardoDatos = function () {

    User.findByIdAndUpdate(userId, {exercises: ejercicios, objective: objective}, function (err, user) {
        if (err) {
            return nextJorge(err);
        } else {
            response.json({objetivo:objective, ejerciciosObj: ejercicios});
        }
    });
};
eventEmitter.on('eventoGuardarDatosUsuario', guardoDatos);

var createToken = function (user) {

    if (user != undefined || user != null) {
        var token = {};
        var payload = {
            sub: user._id,
            iat: moment().unix(),
            exp: moment().add(7, "days").unix()
        };
        token.expire = payload.exp;
        token.payload = jwt.encode(payload, config.sessionSecret);
        return token;
    }
};

var responseTokenUser = function (user) {
    var obj;
    if (user != undefined || user != null) {
        var token = createToken(user);
        var userDTO = {id: user.id, username: user.username, firstName:user.firstName, lastName:user.lastName};
        obj = {success: true, expire: token.expire, token: 'JWT ' + token.payload, user: userDTO};
    }
    //Si tiene ejercicios y objetivo tambien se los manda
    if( user.objective != undefined && user.exercises != undefined){
        obj.objective = user.objective;
        obj.exercises = user.exercises;
    }
    return obj;
};

var setExerciseSets = function (array, set) {

    for (var i = 0; i < array.length; i++) {
        array[i].sets = set;
    }
};


var getSets = function (setNumber, setReps, exercise) {

    var sets = [];

    for (var i = 1; i <= setNumber; i++) {

        sets.push({"number": i, "rep": setReps, "weight": 0, "done": false});
    }

    if (exercise.biceps != undefined) {

        setExerciseSets(exercise.biceps, sets);
    }
    if (exercise.triceps != undefined) {

        setExerciseSets(exercise.triceps, sets);
    }
    if (exercise.back != undefined) {

        setExerciseSets(exercise.back, sets);
    }
    if (exercise.shoulders != undefined) {

        setExerciseSets(exercise.shoulders, sets);
    }
    if (exercise.chest != undefined) {

        setExerciseSets(exercise.chest, sets);
    }

    ejercicios = deepcopy(exercise);
    eventEmitter.emit('eventoGuardarDatosUsuario');

    return exercise;
};

var getExerciseCustom = function (objective, exercises) {

    if (objective != undefined && exercises != undefined) {

        switch (objective.name) {

            case 'Get Slim':
                return getSets(6, 25, exercises);
                break;

            case 'Get Fit':
                return getSets(5, 15, exercises);
                break;

            case 'Get Big':
                return getSets(6, 12, exercises);
                break;

            case 'Get Strong':
                return getSets(5, 5, exercises);
                break;

            default:
                console.log("Error en user.server controller")
                break;
        }
    }
};


var httpStatusCode = function(errorMsg){
    var num = -1;
    if(errorMsg != undefined){
        var msgs = errorMsg.split(':');
        var tipo = msgs[1];

        if(tipo.includes('$user')){
            num = 1;
        }else if(tipo.includes('$email')){
            num = 2;
        }
    }
    return num;
};

exports.create = function (req, res, next) {

    var user = new User(req.body);
    user.save(function (err) {
        if (err) {

            if(err.code == 11000){
               var num =  httpStatusCode(err.errmsg);

               if(num == 1){
                   res.status(409);
                   res.send({success: false, msg: 'Username already exists'});
               }else if(num == 2){
                   res.status(409);
                   res.send({success: false, msg: 'Email already exists'});
               }else{
                   return next(err);
               }
            }else{
                return next(err);
            }
        } else {
            res.json(responseTokenUser(user));
        }
    });
};

exports.authenticate = function (req, res, next) {

    User.findOne({
        username: req.body.username.toLowerCase()
    }, function (err, user) {
        if (err) {
            return next(err);
        } else {
            if (!user) {
                res.send({success: false, msg: 'Authentication failed. User not found.'});
            } else {
                if (req.body.password == undefined) {
                   res.status(401);
                   res.send({success: false, msg: 'No password field.'});
                    return next();
                } else {
                    if (user.authenticate(req.body.password)) {
                        //retornar tambien objetivo y ejercicios. !!!!
                        var retornar = responseTokenUser(user);
                        res.json(retornar);
                    } else {
                        res.send({success: false, msg: 'Authentication failed. Wrong password.'});
                    }
                }
            }
        }

    });
};

exports.list = function (req, res, next) {

    User.find({}, 'id firstName lastName email', function (err, users) {
        if (err) {
            return next(err);
        } else {
            res.json(users);
        }
    });
};
//
// // Para que devuelva el usuario by ID
exports.read = function (req, res) {
    res.json(req.user);
};

exports.userByID = function (req, res, next, id) {

    User.findOne({
        _id: id
    }, 'id firstName lastName email', function (err, user) {

        if (err) {
            return next(err);
        } else {
            req.user = user;
            next();
        }
    });
};

exports.update = function (req, res, next) {
    userId = req.url.split("/")[2];
    response = res;
    request = req;
    nextJorge = next;

    if (req.body.objective != undefined) {

        Objective.findOne({name: req.body.objective.name}, function (err, data) {
            if (err) {
                return next(err);
            } else {
                objective = deepcopy(data);
                promise.props({
                    biceps: Exercise.find({exerciseMuscleGroupId: 1}).limit(6).execAsync(),
                    triceps: Exercise.find({exerciseMuscleGroupId: 2}).limit(6).execAsync(),
                    chest: Exercise.find({exerciseMuscleGroupId: 3}).limit(6).execAsync(),
                    shoulders: Exercise.find({exerciseMuscleGroupId: 7}).limit(6).execAsync(),
                    back: Exercise.find({exerciseMuscleGroupId: 8}).limit(6).execAsync()
                })
                    .then(function (results) {
                        getExerciseCustom(data, results);
                    })
                    .catch(function (err) {
                        console.log(err);
                        res.sendStatus(500); // oops - we're even handling errors!
                    });
            }
        });

    } else {

        User.findByIdAndUpdate(userId, req.body, 'id firstName lastName email' ,function (err, user) {
            if (err) {
                return next(err);
            } else {
                if(req.body.password != undefined){
                    user.password = req.body.password;
                }
                user.save(function(err) {
                    if (err){
                        throw err;
                    }
                    else{
                        res.json({id:user.id, firstName:user.firstName, lastName:user.lastName});
                    }
                });
            }
        });
    }
};
exports.delete = function (req, res, next) {
    req.user.remove(function (err) {

        if (err) {
            return next(err);
        } else {
            res.json(req.user);
        }
    });
};


