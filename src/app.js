import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import Joi from "joi";
import dayjs from "dayjs";

dotenv.config();

console.log(dayjs())
const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
try {
    await mongoClient.connect()
    db = mongoClient.db()
    console.log('db conectou')
} catch (error) {
    console.log(error)
}

const server = express();
server.use(cors());
server.use(express.json());

server.post("/participants", async (req, res) => {
    const { name } = req.body;
    try {
        Joi.string().min(1).validate(name)
        if(await db.collection("participants").findOne({ name: name })){res.status(409).send('usuario ja cadastrado') }
        await db.collection("participants").insertOne({ name, lastStatus: Date.now() })
        await db.collection("messages").insertOne({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format(HH,MM,SS)})
        res.sendStatus(201)
    }
    catch (err) {
        console.log(err);
        res.sendStatus(422);
    }
})

const PORT = 5000;
server.listen(PORT, () => console.log('servidor funcionando'))

