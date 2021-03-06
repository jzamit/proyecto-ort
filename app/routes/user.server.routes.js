var users = require('../../app/controllers/user.server.controller');
var validateToken = require('../../config/validateRequest');

module.exports = function (app) {

   app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Credentials", "true");
        res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT, DELETE");
        res.header("Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, Authorization");

       next();
    });

    app.route('/users').post(users.create).get(users.list);
    app.route('/users/authenticate').post(users.authenticate);
    app.route('/users/:userId').get(users.read).put(validateToken,users.update).delete(validateToken,users.delete);
    app.param('userId', users.userByID);
};