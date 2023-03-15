import { MachineConfig, send, Action, assign } from "xstate";

function say(text: string): Action<SDSContext, SDSEvent> {
  return send((_context: SDSContext) => ({ type: "SPEAK", value: text }));
}

interface Grammar {
  [index: string]: {
    intent: string;
    entities: {
      [index: string]: string;
    };
  };
}



const grammar: Grammar = {
  lecture: {
    intent: "None",
    entities: { title: "Dialogue systems lecture" },
  },
  lunch: {
    intent: "None",
    entities: { title: "Lunch at the canteen" },
  },
  "on friday": {
    intent: "None",
    entities: { day: "Friday" },
  },
  "at ten": {
    intent: "None",
    entities: { time: "10:00" },
  },
  "meeting": {
  intent: "meeting",
  entities: { choice: "booking a meeting"},
  },
  "information": {
  intent: "information",
  entities: { choice: "finding information"},
  },
  "celebrity": {
  intent: "None",
  entities: { celeb: "celebrity"},
  },
  
};

const getEntity = (context: SDSContext, entity: string) => {
  // lowercase the utterance and remove tailing "."
  let u = context.recResult[0].utterance.toLowerCase().replace(/\.$/g, "");
  if (u in grammar) {
    if (entity in grammar[u].entities) {
      return grammar[u].entities[entity];
    }
  }
  return false;
};

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = {
  initial: "idle",
  states: {
    idle: {
      on: {
        CLICK: "init",
      },
    },
    init: {
      on: {
        TTS_READY: "menu",
        CLICK: "menu",
      },
    },
    
    menu: {
/* // test RB
      entry: [ send((context) => ({
        type: "SPEAK",
        value: "That's so great to hear. Meeting with X",
      })), 
      assign({title : "Meeting with X"}),    ],
*/ 
 // test, RB   

      on: {
        RECOGNISED: [
          {
            target: "welcome",
            cond: (context) => getEntity(context, "choice") === "booking a meeting",
            actions: assign({
              choice: (context) => getEntity(context, "choice"),
            }),
          },
          {
            target: "information",
            cond: (context) => getEntity(context, "choice") === "finding information",
            actions: assign({
              choice: (context) => getEntity(context, "choice"),
            }),
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt",
      },
      
          
      
      initial: "prompt",      
      
      states: {
/*
        test: {
        invoke: {
//        id: 'test',
        src: (context, event) => kbRequest("kate perry"),
        onDone: [
        {
          target: "#root.dm.info_three",
          cond: (context,event) => event.data.AbstractText !== "",
          actions:  assign({ info: (context, event) => event.data.AbstractText }),
        },
        {
           target: "#root.dm.failure_one"
        },
        ],
        onError: {
          target: "#root.dm.failure"
        },           
      },
        },
*/        
        prompt: {
          entry: say("Do you want to book a meeting or find information about someone?"),  
          actions: assign({
            
              choice: "booking a meeting",
            }),
          on: { ENDSPEECH: "ask" },
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say(
            "Sorry, I don't know what it is. Tell me something I know."
          ),
          on: { ENDSPEECH: "ask" },
        },
      },
    },
    
    
    welcome: {
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "info",
            cond: (context) => !!getEntity(context, "title"),
            actions: assign({
              title: (context) => getEntity(context, "title"),
            }),
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt",
      },
      states: {
        prompt: {
          entry: say("Ok, let's create a meeting. What is it about?"),
          on: { ENDSPEECH: "ask" },
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say(
            "Sorry, I don't know what it is. Tell me something I know."
          ),
          on: { ENDSPEECH: "ask" },
        },
      },
    },
    
    information: {
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "get_info",
            actions: assign({
              celeb: (context) => context.recResult[0].utterance.toLowerCase().replace(/.$/g, ""),
            }),
          },
          {
            target: ".nomatch",
          },
        ],
        TIMEOUT: ".prompt",
      },
      states: {
        prompt: {
          entry: say("Ok, who do you want information about?"),
          on: { ENDSPEECH: "ask" },
        },
        ask: {
          entry: send("LISTEN"),
        },
        nomatch: {
          entry: say(
            "Sorry, I don't know what it is. Tell me something I know."
          ),
          on: { ENDSPEECH: "ask" },
        },
      },
    },    
    
    
    
    info: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `OK, ${context.title}`,
      })),
      on: { ENDSPEECH: "init" },
    },
    
    get_info: {
      invoke: {
        id: 'get_info',
        src: (context, event) => kbRequest(context.celeb),
        onDone: [
        {
          target: "info_three",
          cond: (context,event) => event.data.AbstractText !== "",
          actions:  assign({ info: (context, event) => {return event.data.AbstractText } }),
        },
        {
           target: "failure_one"
        },
        ],
        onError: {
          target: "failure"
        },           
      },
    },

    failure_one: {
      entry: send((context) => ({
        type: 'SPEAK',
        value: `I don't think ${context.celeb} is a celebrity.`,
      })),
      on: { ENDSPEECH: 'information' }
    },


    
    failure: {
    // never goes here?
      entry: send((context) => ({
        type: 'SPEAK',
        value: `Sorry, there is no information on ${context.celeb} available.`,
      })),
      on: { ENDSPEECH: 'information' }
    },
    
    
    
    info_three: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `OK, info on ${context.celeb} available`,
      })),
      on: { ENDSPEECH: "give_info" },      
    }, 
    
    give_info: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `${context.info}`,
      })),
      on: { ENDSPEECH: "init" },      
    },     
    
    
  },
};

const kbRequest = (text: string) =>
  fetch(
    new Request(
      `https://cors.eu.org/https://api.duckduckgo.com/?q=${text}&format=json&skip_disambig=1`
    )
  ).then((data) => data.json());
