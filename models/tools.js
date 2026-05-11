const {Schema,model} = require("mongoose");

const profileSchema = new Schema({
    user:{
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    /*createdBy: {
        type: Schema.Types.ObjectId,
        ref: "user",
        required: true,
    },*/
    ingredients: {
        type: String,
    },
    analysis: {
        type: Object,
    },
    diseases:{
        type:[String],
        enum:[
            "DIABETES",
            "THYROID",
            "PCOS",
            "OBESITY",
            "METABOLIC_SYNDROME",

            "BP",
            "HEART_DISEASE",
            "HIGH_CHOLESTEROL",
            "STROKE_RISK",
            "ANEMIA",

            "ASTHMA",
            "BRONCHITIS",
            "RESPIRATORY_ALLERGY",

            "KIDNEY_DISEASE",
            "LIVER_DISEASE",
            "FATTY_LIVER",

            "MIGRAINE",
            "ADHD",
            "ANXIETY",
            "INSOMNIA",

            "ALLERGY",
            "LACTOSE_INTOLERANCE",
            "GLUTEN_INTOLERANCE",
            "FOOD_SENSITIVITY",

            "PREGNANCY",
            "CHILD",
            "ELDERLY"
        ],
        default:[],
    },
    notes:{
        type:String,
    },
    productImage:{
        type:String,
        required:true,
    },
},
{timestamps: true},
);

const healthProfile = model("healthProfile",profileSchema);

module.exports = healthProfile;