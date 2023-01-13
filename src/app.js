import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import Joi from "joi";
import dayjs from "dayjs";

dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
try {
    await mongoClient.connect()
    db = mongoClient.db()
} catch (error) {
    console.log(error)
}

const server = express();
server.use(cors());
server.use(express.json());

server.post("/participants", async (req, res) => {
    const { name } = req.body;
    try {
        await Joi.string().min(1).required().validateAsync(name)
        if(await db.collection("participants").findOne({ name: name })){res.status(409).send('usuario ja cadastrado') }
        await db.collection("participants").insertOne({ name, lastStatus: Date.now() })
        await db.collection("messages").insertOne({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH,mm,ss')});
        res.sendStatus(201);
    }
    catch (err) {
        res.sendStatus(422);
    }
})

server.get("/participants",async(_,res)=>{
    try {
        const response = await db.collection("participants").find().toArray()
        res.send(response)
    } catch (error) {
        res.sendStatus(422);
    }
})

server.post("/messages", async (req, res) => {
    const body = req.body;
    const head = req.headers;
    const schema = Joi.object({
        to: Joi.string().min(1).required(),
        text: Joi.string().min(1).required(),
        type: Joi.string().valid('message','private_message').required(),
    })
    try {
        await schema.validateAsync(body)
        if(!await db.collection("participants").findOne({ name: head.user })){throw new Error() }
        await db.collection("messages").insertOne({from: head.user, to: body.to, text: body.text, type: body.type, time: dayjs().format('HH,MM,SS')});
        res.sendStatus(201);
    }
    catch (err) {
        res.sendStatus(422);
    }
})

server.get("/messages",async(req,res)=>{
    const limit = parseInt(req.query.limit)
    console.log(limit)
    try {
        const response = await db.collection("messages")
        .find({$or:[{from:req.headers.user},{type:{$not:/private_message/}}]})
        .limit(limit)
        .toArray()
        res.send(response)
    } catch (error) {
        res.sendStatus(422);
    }
})

const PORT = 5000;
server.listen(PORT, () => console.log('servidor funcionando'))

