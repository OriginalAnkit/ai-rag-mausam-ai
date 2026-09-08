// import OpenAI from "openai";
const OpenAI = require("openai");

const client1 = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPEN_ROUTER_API_KEY,
});
const client2 = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPEN_ROUTER_API_KEY_2,
});

const callOpenRouterModel = async function (messages,backup=false) {
    const requestPayload = {
        // model: "minimax/minimax-m3:free",
        // model: "google/gemma-4-31b-it:free",
        // model:"cohere/north-mini-code:free",
        model: "liquid/lfm-2.5-2.6b:free",
        // model:"poolside/laguna-s-2.1:free",
        // model:"thinkingmachines/inkling-small:free",
        messages: messages,
        response_format: { type: "json_object" }
    };

     return await (backup?client2:client1).chat.completions.create(requestPayload);
}

const MAIN_SYSTEM_PROMPT = `
You are an AI agent that reply only to queries related to weather, temperate and humidity.

STRICT RULES:
- output must a single valid json without any extra space, text. NO markdown , No Text, No output tags.
- MUST run one step at a time. Do not run multiple steps in parallel. Stop after each step
- Strictly follow the Sequence of steps must be START then PLAN then TOOL then OUTPUT
- don't run a step more than once for a single query.
- If answer not found just say not able to answer it right now
- If user asking for unrelated question then return the final step


For any other query you reply with 
{step:OUTPUT:context:"I'm sorry, I can help you with weather ,temperature and humidity related queries only."}
If tool is needed to get the output call tools.



OUTPUT FORMAT:
{
    "step": START|PLAN|TOOL|OUTPUT,
    "context": "string",
    "input": "string",
    "usefull": "boolean",
    "toolname": "string",
}
Step : denotes at which step you are in. START|PLAN|TOOL|OUTPUT
context : denotes are you are tying to do
input : denotes the input required by the tool
usefull : return true/false based on the context usefullness -> return false for all response that are not need to be maintained in context/ chat history
toolname : denotes the name of the tool

AVAILABLE TOOL:
- get_mausam -> return temperate, weather and humidity for a given location

Example:
USER: Can you tell the weather in Mumbai?
OUTPUT:
{step:START , context:"you want to know the weather in Mumbai", input:null, usefull:false, toolname:null}
{step:PLAN , context:"I will call get_mausam tool to get the weather in Mumbai", input:Mumbai, usefull:false, toolname:get_mausam}
{step:TOOL , context:"calling get_mausam tool", input:Mumbai, usefull:false, toolname:get_mausam}
{step:OUTPUT , context:"The weather in Mumbai is sunny", input:null, usefull:true, toolname:null}
`

function safeParseJSON(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        // try stripping markdown fences some models add anyway
        const cleaned = str.replace(/```json|```/g, "").trim();
        try {
            return JSON.parse(cleaned);
        } catch (e2) {
            return null;
        }
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function getWeather(city) {
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=%c+%C+%t+%h+%T`;
    // const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;


    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.text(); // wttr.in returns plain text, not JSON
        return data.trim();
    } catch (err) {
        console.error("Error fetching weather:", err.message);
        throw err;
    }
}

const getConversation=async function (messages,context=[]){ 
    while(true){
        completion = await callOpenRouterModel(messages)
        console.log(completion?.choices[0].message)
        output = completion?.choices[0].message.content
        if(!output){
            completion = await callOpenRouterModel(messages,true)
            output = completion?.choices[0].message.content
        }
        // console.log('ouptput===> ', completion, '<<<<')
        if (typeof output === "string") {
            output = safeParseJSON(output)
        }
        console.log('ouptput===> ', output, '<<<<')
        if (output?.step === "OUTPUT") {
            context.push({ sender: "SYSTEM", message: output.context })
            return
        }else if(output?.step === "TOOL"){
            if(output.toolname === "get_mausam"){
               let tool_resp = await getWeather(output.input)
               if(tool_resp){
                context.push({ sender: "BOT", message: 'got response from bot '+ tool_resp })
                messages.push({ role: "system", content: `RESPONSE FROM ${output.toolname}: ${tool_resp}; now proceed to next step` })

               }
            }
        } else {
            context.push({ sender: "BOT", message: output.context + '...' })
            messages.push({ role: "system", content: completion?.choices[0].message.content })
            console.log('messages===> ', messages, '<<<<')
        }
        await sleep(5000)
    }
    // console.log('===> ',completion?.choices[0].message.content,'<<<<')
    // context.push({sender:"BOT",message:completion?.choices[0].message.content})

}
const generatResponse = async function (context) {
    messages = [{ role: "system", content: MAIN_SYSTEM_PROMPT }]
    context.forEach(msg => {
        if (msg.sender === "BOT") { //<<--- ignoring bot messages (thinking)
            return
        } else {
            messages.push({ role: msg.sender.toLowerCase(), content: msg.message }) // {role: system/user , content: message}
        }
    })
    getConversation(messages,context)
    


}

module.exports = { generatResponse }