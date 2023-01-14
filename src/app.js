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
    const validation = Joi.string().min(1).required().validate(name, { abortEarly: true });
     
    if (validation.error) {
        return res.status(422).send(validation.error.details)
    }
    try {
        if (await db.collection("participants").findOne({ name: name })) { return res.status(409).send('usuario ja cadastrado'); }
        await db.collection("participants").insertOne({ name, lastStatus: Date.now() })
        await db.collection("messages").insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:mm:ss') });
        return res.sendStatus(201);
    }
    catch (err) {
        return res.sendStatus(422);
    }
})

server.get("/participants", async (_, res) => {
    try {
        const response = await db.collection("participants").find().toArray()
        return res.send(response)
    } catch (error) {
        return res.sendStatus(422);
    }
})

server.post("/messages", async (req, res) => {
    const body = req.body;
    const head = req.headers;
    const schema = Joi.object({
        to: Joi.string().min(1).required(),
        text: Joi.string().min(1).required(),
        type: Joi.string().valid('message', 'private_message').required(),
    })
    const validation = schema.validate(body, { abortEarly: true });

    if (validation.error) {
        return res.status(422).send(validation.error.details)
    }
    try {
        if (!await db.collection("participants").findOne({ name: head.user })) {throw new Error() }
        await db.collection("messages").insertOne({ from: head.user, to: body.to, text: body.text, type: body.type, time: dayjs().format('HH:mm:ss') });
        return res.sendStatus(201);
    }
    catch (err) {
        return res.sendStatus(422);
    }
})

server.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit)
    if(limit<=0)return res.sendStatus(422)
    try {
        const response = await db.collection("messages")
            .find({ $or: [{ from: req.headers.user }, { type: { $not: /private_message/ } }] })
            .sort({_id:-1})
            .limit(limit)
            .toArray()
        return res.send(response)
    } catch (error) {
        return res.sendStatus(422);
    }
})

server.post("/status", async (req, res) => {
    try {
        const result = await db.collection("participants")
            .updateOne({ name: req.headers.user }, { $set: { lastStatus: Date.now() } })
        if (result.modifiedCount === 0) { res.sendStatus(404); }
        return res.send()
    } catch (error) {
        return res.sendStatus(422);
    }
})

setInterval(() => automaticRemoveInactiveUsers(), 15000);
async function automaticRemoveInactiveUsers() {
    try {
        const result = await db.collection("participants").find({lastStatus: {$lte: Date.now()-15000}}).toArray()
        const toInsertArr = result.map(participant => {
            return {
                from: participant.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            }
        })
        await db.collection("participants").deleteMany({name:{$in: result.map(doc=>doc.name)}});
        await db.collection("messages").insertMany(toInsertArr);
    } catch (error) {

    }
}

const PORT = 5000;
server.listen(PORT, () => console.log('servidor funcionando'))

