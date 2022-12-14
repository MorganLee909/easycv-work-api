const Cv = require("../models/cv.js");
const Employer = require("../models/employer.js");

const ObjectId = require("mongoose").Types.ObjectId;

module.exports = {
    /*
    GET: retrieve all CV's for the logged in user
    response = [CV]
    */
    retrieveMany: function(req, res){
        res.locals.user.populate("cvs")
            .then((user)=>{
                return user.populate("cvs.workHistory.employer");
            })
            .then((user)=>{
                return res.json(user);
            })
            .catch((err)=>{
                console.error(err);
                return res.json("ERROR: unable to retrieve CV's");
            });
    },

    /*
    GET: retrieve a single CV
    req.params.cv = CV id
    response = CV
    */
    retrieve: function(req, res){
        Cv.findOne({_id: req.params.cv})
            .populate("user")
            .populate("workHistory.employer")
            .then((cv)=>{
                cv.user.password = undefined;
                cv.user.cvs = undefined;
                cv.user.session = undefined;

                return res.json(cv);
            })
            .catch((err)=>{
                console.error(err);
                return res.json("Error: unable to retrieve CV data");
            });
    },

    /*
    POST: create new cv for the logged in user
    req.body = {
        jobTitle: String
        jobCategory: String
        experience: Number
        skills: [String]
        workHistory: [{
            employer: Employer || String
            newEmployer: Boolean
            startDate: Date
            endDate: Date (optional)
            description: String
        }]
    }
    */
    create: function(req, res){
        let cv = new Cv({
            user: res.locals.user._id,
            jobTitle: req.body.JobTitle,
            jobCategory: req.body.jobCategory,
            experience: req.body.experience,
            skills: req.body.skills,
            workHistory: []
        });

        for(let i = 0; i < req.body.workHistory.length; i++){
            let wh = req.body.workHistory[i];
            let employer = wh.employer;

            if(wh.newEmployer){
                let e = new Employer({name: wh.employer});
                e.save().catch((err)=>{console.error(err)});
                employer = e._id;
            }

            cv.workHistory.push({
                employer: employer,
                startDate: new Date(wh.startDate),
                endDate: wh.endDate ? new Date(wh.endDate) : undefined,
                description: wh.description
            });
        }

        res.locals.user.cvs.push(cv._id);

        Promise.all([cv.save(), res.locals.user.save()])
            .then((response)=>{
                return res.json(response[0]);
            })
            .catch((err)=>{
                console.error(err);
                return res.json("ERROR: unable to create new CV");
            });
    },

    /*
        PUT: update a Cv
        req.body = {
            cv: String id
            jobTitle: String
            jobCategory: String
            experience: Number
            skills: [String]
            newEmployment: [{
                employer: Employer id || String,
                newEmployer: Boolean
                startDate: Date
                endDate: Date
                description: String
            }],
            removeEmployment: [workHistory id]
        }
    */
    update: function(req, res){
        Cv.findOne({_id: req.body.cv})
            .then((cv)=>{
                if(!cv) throw "cv";
                if(cv.user.toString() !== res.locals.user._id.toString()) throw "user";

                if(req.body.jobTitle) cv.jobTitle = req.body.jobTitle;
                if(req.body.jobCategory) cv.jobCategory = req.body.jobCategory;
                if(req.body.experience) cv.experience = req.body.experience;
                if(req.body.skills) cv.skills = req.body.skills;

                if(req.body.newEmployment){
                    for(let i = 0; i < req.body.newEmployment.length; i++){
                        let wh = req.body.newEmployment[i];
                        let employer = wh.employer;
                        
                        if(wh.newEmployer){
                            let e = new Employer({name: wh.employer});
                            e.save().catch((err)=>{console.error(err)});
                            employer = e._id;
                        }
                        
                        cv.workHistory.push({
                            employer: employer,
                            startDate: new Date(wh.startDate),
                            endDate: wh.endDate ? new Date(wh.endDate) : undefined,
                            description: wh.description
                        });
                    }
                }

                if(req.body.removeEmployment){
                    for(let i = 0; i < req.body.removeEmployment.length; i++){
                        for(let j = 0; j < cv.workHistory.length; j++){
                            if(req.body.removeEmployment[i] === cv.workHistory[j]._id.toString()){
                                cv.workHistory.splice(j, 1);
                                break;
                            }
                        }
                    }
                }

                return cv.save();
            })
            .then((cv)=>{
                return res.json(cv);
            })
            .catch((err)=>{
                switch(err){
                    case "cv": return res.json("CV does not exist");
                    case "user": return res.json("User does not own that CV");
                    default:
                        console.error(err);
                        return res.json("ERROR: unable to update CV");
                }
            });
    },

    /*
    DELETE: delete a single cv
    req.params = {
        cv: CV id
    }
    response = {}
    */
    delete: function(req, res){
        for(let i = 0; i < res.locals.user.cvs.length; i++){
            let cv = res.locals.user.cvs[i];

            if(cv.toString() === req.params.cv){
                res.locals.user.cvs.splice(i, 1);

                let cvDelete = Cv.deleteOne({_id: req.params.cv});

                return Promise.all([cvDelete, res.locals.user.save()])
                    .then((response)=>{
                        return res.json({});
                    })
                    .catch((err)=>{
                        console.error(err);
                        return res.json("ERROR: unable to delete CV");
                    });
            }
        }

        return res.json("You do not have permission to delete that CV");

        // Cv.findOne({_id: req.params.cv})
        //     .then((cv)=>{
        //         if(res.locals.user._id.toString() !== cv.user.toString()) throw "user";

        //         return Cv.deleteOne({_id: cv._id});
        //     })
        //     .then((response)=>{
        //         return res.json({});
        //     })
        //     .catch((err)=>{
        //         console.error(err);
        //         return res.json("ERROR: unable to delete CV");
        //     });
    }
}