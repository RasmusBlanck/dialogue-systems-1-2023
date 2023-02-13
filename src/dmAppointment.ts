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
};

const getEntity = (context: SDSContext, entity: string) => {

  ent = context.nluResult.prediction.entities;
  
  for (i=0; i<ent.length; i++)
    if( ent[i].category === entity) 
      return ent[i].text;
  return false;
}


const getIntent = (context: SDSContext) => {
  return context.nluResult.prediction.topIntent;
}


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
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
           target: "welcomeTwo",
           cond: (context) => getIntent(context) === "meeting" && !!getEntity(context, "title") && !!getEntity(context, "day"),
            actions: assign({
              title: (context) => getEntity(context, "title"),
              day: (context) => getEntity(context, "day"),              
              choice: "booking a meeting",
            }),
          },
          {
           target: "welcomeThree",
           cond: (context) => getIntent(context) === "meeting" && !!getEntity(context, "title"),
            actions: assign({
              title: (context) => getEntity(context, "title"),
              choice: "booking a meeting",
            }),
          }, 
          {
           target: "welcomeFour",
           cond: (context) => getIntent(context) === "meeting" && !!getEntity(context, "day"),
            actions: assign({
              day: (context) => getEntity(context, "day"),              
              choice: "booking a meeting",
            }),
          }, 
          {
           target: "welcome",
           cond: (context) => getIntent(context) === "meeting",
            actions: assign({
            
              choice: "booking a meeting",
            }),
          },          
                            
          {
            target: "information",
            cond: (context) => getIntent(context) === "information",
            actions: assign({
              choice: "finding information",
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
          entry: say('Do you want to book a meeting or find information about someone?'),
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


    welcomeTwo: {
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "decideTime",
            cond: (context) => !!getEntity(context, "time"),
            actions: assign({
              title: (context) => getEntity(context, "time"),
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
          entry: send((context) => ({
          type: 'SPEAK',
          value: `Ok, let's creat a meeting for ${context.title} on ${context.day}. At what time is it?`,
        })),
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

    welcomeThree: {
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "decideTime",
            cond: (context) => !!getEntity(context, "time"),
            actions: assign({
              title: (context) => getEntity(context, "time"),
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
          entry: send((context) => ({
          type: 'SPEAK',
          value: `Ok, let's creat a meeting for ${context.title}. On what day is it?`,
        })),
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

    welcomeFour: {
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "decideTime",
            cond: (context) => !!getEntity(context, "time"),
            actions: assign({
              title: (context) => getEntity(context, "time"),
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
          entry: send((context) => ({
          type: 'SPEAK',
          value: `Ok, let's creat a meeting on ${context.day}. What is it about?`,
        })),
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



    decideTime: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `OK, going to ask for the time`,
      })),
      on: { ENDSPEECH: "init" },
    },


    decideDay: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `OK, going to ask for the time`,
      })),
      on: { ENDSPEECH: "init" },
    },

    decideTitle: {
      entry: send((context) => ({
        type: "SPEAK",
        value: `OK, going to ask for the time`,
      })),
      on: { ENDSPEECH: "init" },
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
          actions:  assign({ info: (context, event) => event.data.AbstractText }),
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
      on: { ENDSPEECH: "init" },
    }, 
  },
};



/*export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = {
  initial: "idle",
  states: {
    idle: {
      on: {
        CLICK: "init",
      },
    },
    init: {
      on: {
        TTS_READY: "welcome",
        CLICK: "welcome",
      },
    },
    welcome: {
      initial: "prompt",
      on: {
        RECOGNISED: [
          {
            target: "info",
            cond: (context) => !!getEntity(context, "nluResult"),
            actions: assign({
              title: (context) => getEntity(context, "nluResult"),
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
          entry: say("Let's create a meeting. What is it about?"),
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
        value: `OK, ${context.nluResult}`,
      })),
      on: { ENDSPEECH: "init" },
    },
  },
};
*/

const kbRequest = (text: string) =>
  fetch(
    new Request(
      `https://cors.eu.org/https://api.duckduckgo.com/?q=${text}&format=json&skip_disambig=1`
    )
  ).then((data) => data.json());
