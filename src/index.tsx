import "./styles.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Machine, assign, actions, State } from "xstate";
import { useMachine, asEffect } from "@xstate/react";
import { inspect } from "@xstate/inspect";
import SpeechRecognition from 'react-speech-recognition';
import { tdmDmMachine } from "./tdmClient";
import { jaicpDmMachine } from "./jaicpClient";
import { dmMachine } from "./dmColourChanger";

import createSpeechRecognitionPonyfill from 'web-speech-cognitive-services/lib/SpeechServices/SpeechToText'
import createPonyfill from 'web-speech-cognitive-services/lib/SpeechServices';

let dm = dmMachine
if (process.env.REACT_APP_BACKEND === 'TDM') {
    dm = tdmDmMachine
} else if (process.env.REACT_APP_BACKEND === 'JAICP') {
    dm = jaicpDmMachine
}

const { send, cancel } = actions

const TOKEN_ENDPOINT = 'https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken';
const REGION = 'northeurope';

inspect({
    url: "https://statecharts.io/inspect",
    iframe: false
});


const defaultPassivity = 10

const machine = Machine<SDSContext, any, SDSEvent>({
    id: 'root',
    type: 'parallel',
    states: {
        dm: {
            ...dm
        },
        asrtts: {
            initial: 'prepare',
            states: {
                prepare: {
                    invoke: {
                        id: "getAuthorizationToken",
                        src: (_ctx, _evt) => getAuthorizationToken(),
                        onDone: {
                            actions: [
                                assign((_context, event) => { return { azureAuthorizationToken: event.data } }),
                                'ponyfillTTS', 'ponyfillASR'],
                            target: 'idle'
                        },
                        onError: {
                            target: 'fail'
                        }
                    }
                },
                idle: {
                    on: {
                        LISTEN: 'recognising',
                        SPEAK: {
                            target: 'speaking',
                            actions: assign((_context, event) => { return { ttsAgenda: event.value } })
                        }
                    },
                },
                recognising: {
                    initial: 'noinput',
                    entry: 'recStart',
                    exit: 'recStop',
                    on: {
                        ASRRESULT: {
                            actions: ['recLogResult',
                                assign((_context, event) => {
                                    return {
                                        recResult: event.value
                                    }
                                })],
                            target: '.match'
                        },
                        RECOGNISED: 'idle',
                    },
                    states: {
                        noinput: {
                            entry: send(
                                { type: 'TIMEOUT' },
                                { delay: (context) => (1000 * (defaultPassivity || context.tdmPassivity)), id: 'timeout' }
                            ),
                            on: {
                                TIMEOUT: '#root.asrtts.idle',
                                STARTSPEECH: 'inprogress'
                            },
                            exit: cancel('timeout')
                        },
                        inprogress: {
                        },
                        match: {
                            entry: send('RECOGNISED'),
                        },
                    }
                },
                speaking: {
                    invoke: {
                        id: 'ttsStart',
                        src: (context, _event) => (callback, _onReceive) => {
                            const utterance = new context.ttsUtterance(context.ttsAgenda);
                            const voices = context.tts.getVoices();
                            let voiceRe = RegExp("en-US", 'u')
                            if (process.env.REACT_APP_TTS_VOICE) {
                                voiceRe = RegExp(process.env.REACT_APP_TTS_VOICE, 'u')
                            }
                            const voice = voices.find(v => voiceRe.test(v.name))!
                            if (voice) {
                                utterance.voice = voice
                                utterance.onend = () => callback('ENDSPEECH')
                                console.log(`${utterance.voice.name} is speaking`);
                                context.tts.speak(utterance)
                            }
                            else {
                                console.error(`TTS_ERROR: Could not get voice for regexp ${voiceRe}`)
                                callback('TTS_ERROR')
                            }
                        }
                    },
                    on: {
                        ENDSPEECH: 'idle',
                        TTS_ERROR: 'fail'
                    }
                    /* entry: 'ttsStart',
                     * on: {
                     *     ENDSPEECH: 'idle',
                     * } */
                },
                fail: {}
            }
        }
    },
},
    {
        actions: {
            recLogResult: (context: SDSContext) => {
                /* context.recResult = event.recResult; */
                console.log('<< ASR: ' + context.recResult[0]["utterance"]);
            },
            test: () => {
                console.log('test')
            },
            logIntent: (context: SDSContext) => {
                /* context.nluData = event.data */
                console.log('<< NLU intent: ' + context.nluData.intent.name)
            }
        },
    });



interface Props extends React.HTMLAttributes<HTMLElement> {
    state: State<SDSContext, any, any, any>;
}
const ReactiveButton = (props: Props): JSX.Element => {
    switch (true) {
        case props.state.matches({ asrtts: 'fail' }) || props.state.matches({ dm: 'fail' }):
            return (
                <div className="control">
                    <div className="status">Something went wrong...</div>
                    <button type="button" className="circle"
                        style={{}} {...props}>
                    </button>
                </div>);
        case props.state.matches({ asrtts: 'recognising' }):
            return (
                <div className="control">
                    <div className="status-talk">talk</div>
                    <button type="button" className="circle"
                        style={{ animation: "bordersize 2s infinite" }} {...props}>
                    </button>
                </div>
            );
        case props.state.matches({ asrtts: 'speaking' }):
            return (
                <div className="control">
                    <div className="status">speaking</div>
                    <button type="button" className="circle-speaking"
                        style={{ animation: "bordering 2s infinite" }} {...props}>
                    </button>
                </div>
            );

        case props.state.matches({ dm: 'init' }):
            return (
                <div className="control" {...props}>
                    <div className="status-talk">click to start!</div>
                    <button type="button" className="circle-click"
                        style={{}}>
                    </button>
                </div>
            );

        default:
            return (
                <div className="control">
                    <div className="status-talk"></div>
                    <button type="button" className="circle"
                        style={{}} {...props}>
                    </button>
                </div>
            );
    }
}


function App() {

    const startListening = () => {
        SpeechRecognition.startListening({
            continuous: true,
            language: process.env.REACT_APP_ASR_LANGUAGE || 'en-US'
        });
    }
    const stopListening = () => {
        SpeechRecognition.stopListening()
    }


    const [current, send] = useMachine(machine, {
        devTools: true,
        actions: {
            recStart: asEffect(() => {
                console.log('Ready to receive a voice input.');
                startListening()
            }),
            recStop: asEffect(() => {
                console.log('Recognition stopped.');
                stopListening()
            }),
            ttsStart: asEffect((context) => {
                const voices = context.tts.getVoices();
                const utterance = new context.ttsUtterance(context.ttsAgenda);
                let voiceRe = RegExp("en-US-AriaNeural", 'u')
                if (process.env.REACT_APP_TTS_VOICE) {
                    voiceRe = RegExp(process.env.REACT_APP_TTS_VOICE, 'u')
                }
                utterance.voice = voices.find(v => voiceRe.test(v.name))!
                console.log(`${utterance.voice.name} is speaking`);
                utterance.onend = () => send('ENDSPEECH')
                context.tts.speak(utterance)
            }),
            ttsCancel: asEffect(() => {
                console.log('TTS STOP...');
                /* cancel() */
                speechSynthesis.cancel()
            }),
            ponyfillTTS: asEffect((context, _event) => {
                const ponyfill = createPonyfill({
                    credentials: {
                        region: REGION,
                        authorizationToken: context.azureAuthorizationToken,
                    }
                });
                const { speechSynthesis, SpeechSynthesisUtterance } = ponyfill;
                context.tts = speechSynthesis
                context.ttsUtterance = SpeechSynthesisUtterance
            }),
            ponyfillASR: asEffect((context, _event) => {
                const
                    { SpeechRecognition: AzureSpeechRecognition }
                        = createSpeechRecognitionPonyfill({
                            credentials: {
                                region: REGION,
                                authorizationToken: context.azureAuthorizationToken,
                            }
                        });
                SpeechRecognition.applyPolyfill(AzureSpeechRecognition)
                context.asr = SpeechRecognition.getRecognition()!
                context.asr.onresult = function(event: any) {
                    var result = event.results[0]
                    if (result.isFinal) {
                        send({
                            type: "ASRRESULT", value:
                                [{
                                    "utterance": result[0].transcript,
                                    "confidence": result[0].confidence
                                }]
                        })
                    } else {
                        send({ type: "STARTSPEECH" });
                    }
                }
            })
        }
    });


    return (
        <div className="App">
            <ReactiveButton state={current} onClick={() => send('CLICK')} />
        </div>
    )
};

const getAuthorizationToken = () => (
    fetch(new Request(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': process.env.REACT_APP_SUBSCRIPTION_KEY!
        },
    })).then(data => data.text()))


const rootElement = document.getElementById("root");
ReactDOM.render(
    <App />,
    rootElement);


