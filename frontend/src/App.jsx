import {
  useState,
  useRef,
  useEffect,
} from "react"

import {
  Mic,
  Send,
} from "lucide-react"

import { motion } from "framer-motion"

function App() {
  const [message, setMessage] = useState("")

  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "Hello Santhosh 👋 I’m Lucy, your AI companion.",
    },
  ])

  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [wakeMode, setWakeMode] = useState(true)
  const [emotion, setEmotion] = useState("calm")
  const [appState, setAppState] = useState("IDLE")
  const [audioLevel, setAudioLevel] = useState(0)

  const recognitionRef = useRef(null)
  const wakeRecognitionRef = useRef(null)

  const currentSpeechRef = useRef(null)

  const audioContextRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const animationFrameRef = useRef(null)

  const isProcessingRef = useRef(false)

  const speechQueueRef = useRef([])
  const isSpeechPlayingRef = useRef(false)

  const silenceTimeoutRef = useRef(null)

  const cleanupAudioResources = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    if (wakeRecognitionRef.current) {
      wakeRecognitionRef.current.onend = null
      wakeRecognitionRef.current.stop()
      wakeRecognitionRef.current = null
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
    }

    speechQueueRef.current = []
    isSpeechPlayingRef.current = false

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current
        .getTracks()
        .forEach((track) => track.stop())

      mediaStreamRef.current = null
    }

    setIsListening(false)
    setIsSpeaking(false)
    setIsThinking(false)
    setAudioLevel(0)
    setAppState("IDLE")
  }

  const getPreferredVoice = () => {
    const voices = window.speechSynthesis.getVoices()

    return (
      voices.find((v) => v.name.includes("Samantha")) ||
      voices.find((v) => v.name.includes("Victoria")) ||
      voices.find((v) => v.name.includes("Karen")) ||
      voices.find((v) => v.name.includes("Moira")) ||
      voices.find((v) => v.name.includes("Tessa")) ||
      voices.find((v) => v.name.includes("Google UK English Female")) ||
      voices.find((v) => v.name.includes("Female")) ||
      voices[0]
    )
  }

  const speakText = (text) => {
    if (!text.trim()) return

    speechQueueRef.current.push(text)

    if (isSpeechPlayingRef.current) return

    const playNext = () => {
      if (speechQueueRef.current.length === 0) {
        isSpeechPlayingRef.current = false
        setIsSpeaking(false)
        setAppState("IDLE")
        return
      }

      isSpeechPlayingRef.current = true

      const textToSpeak =
        speechQueueRef.current.shift()

      const speech = new SpeechSynthesisUtterance(
        textToSpeak
      )

      speech.lang = "en-US"
      speech.voice = getPreferredVoice()
      speech.rate = 0.82
      speech.pitch = 1

      currentSpeechRef.current = speech

      setIsSpeaking(true)
      setAppState("SPEAKING")

      speech.onend = () => {
        currentSpeechRef.current = null
        playNext()
      }

      speech.onerror = () => {
        currentSpeechRef.current = null
        playNext()
      }

      window.speechSynthesis.cancel()

      setTimeout(() => {
        window.speechSynthesis.speak(speech)
      }, 80)
    }

    playNext()
  }

  const startAudioVisualization = async () => {
    try {
      if (mediaStreamRef.current) return

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        })

      mediaStreamRef.current = stream

      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext

      const audioContext = new AudioContext()

      const analyser = audioContext.createAnalyser()

      analyser.fftSize = 256

      const microphone =
        audioContext.createMediaStreamSource(stream)

      microphone.connect(analyser)

      audioContextRef.current = audioContext

      const dataArray = new Uint8Array(
        analyser.frequencyBinCount
      )

      const updateAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray)

        const average =
          dataArray.reduce((a, b) => a + b, 0) /
          dataArray.length

        setAudioLevel(average)

        animationFrameRef.current =
          requestAnimationFrame(updateAudioLevel)
      }

      updateAudioLevel()
    } catch (error) {
      console.error(error)
    }
  }

  const stopAllRecognizers = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    } catch (error) {
      console.log(error)
    }

    try {
      if (wakeRecognitionRef.current) {
        wakeRecognitionRef.current.onend = null
        wakeRecognitionRef.current.stop()
        wakeRecognitionRef.current = null
      }
    } catch (error) {
      console.log(error)
    }
  }

  const startWakeWordListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    if (!SpeechRecognition) return

    if (wakeRecognitionRef.current) {
      return
    }

    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = "en-US"
    recognition.maxAlternatives = 1

    setAppState("WAKE_LISTENING")

    recognition.onresult = (event) => {
      const latestResult =
        event.results[event.results.length - 1]

      if (!latestResult.isFinal) return

      const transcript =
        latestResult[0].transcript
          .toLowerCase()
          .trim()

      console.log("WAKE HEARD:", transcript)

      const wakeDetected =
        transcript.includes("hey lucy") ||
        transcript === "lucy" ||
        transcript.startsWith("lucy")

      if (wakeDetected) {
  wakeRecognitionRef.current = null

  recognition.onend = null
  recognition.stop()

  setWakeMode(false)

  setTimeout(() => {
    startListening()
  }, 700)
}
    }

    recognition.onend = () => {
      wakeRecognitionRef.current = null

      if (wakeMode) {
        setTimeout(() => {
          startWakeWordListening()
        }, 500)
      }
    }

    recognition.start()

    wakeRecognitionRef.current = recognition
  }

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition

    if (!SpeechRecognition) return

    if (recognitionRef.current) {
      return
    }

    if (wakeRecognitionRef.current) {
      wakeRecognitionRef.current.onend = null
      wakeRecognitionRef.current.stop()
      wakeRecognitionRef.current = null
    }

    const recognition = new SpeechRecognition()

    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    setIsListening(true)
    setWakeMode(false)
    setAppState("LISTENING")

    recognition.onresult = (event) => {
      const latestResult =
        event.results[event.results.length - 1]

      const transcript =
        latestResult[0].transcript

      const isFinal = latestResult.isFinal

      setMessage(transcript)
      console.log("USER SAID:", transcript)

      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }

      silenceTimeoutRef.current = setTimeout(() => {
        setWakeMode(true)
      }, 30000)

      if (isFinal) {
        const cleaned = transcript
          .toLowerCase()
          .trim()

          if (
  cleaned.includes("stop talking") ||
  cleaned.includes("stop lucy") ||
  cleaned.includes("be quiet")
) {
  window.speechSynthesis.cancel()

  speechQueueRef.current = []
  isSpeechPlayingRef.current = false

  setIsSpeaking(false)
  setIsThinking(false)
  setAppState("IDLE")

  return
}

        if (
  cleaned === "lucy" ||
  cleaned === "hey lucy"
) {
  recognition.stop()

  setTimeout(() => {
    startListening()
  }, 200)

  return
}

        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel()
        }

        setIsListening(false)

        setTimeout(() => {
          sendAutoMessage(transcript)
        }, 120)
      }
    }

    recognition.onerror = (event) => {
      console.log("RECOGNITION ERROR:", event.error)

      recognitionRef.current = null

      setIsListening(false)

      if (
        !wakeMode &&
        !isProcessingRef.current
      ) {
        setTimeout(() => {
          startListening()
        }, 1000)
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null

      if (
        !wakeMode &&
        !isProcessingRef.current
      ) {
        setTimeout(() => {
          startListening()
        }, 600)
      }
    }

    recognition.start()

    recognitionRef.current = recognition

    startAudioVisualization()
  }

  const streamResponse = async (userText) => {
    if (isProcessingRef.current) return

    isProcessingRef.current = true

    try {
      setIsThinking(true)
      setAppState("THINKING")

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "",
        },
      ])

      const response = await fetch(
        "http://127.0.0.1:8000/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userText,
          }),
        }
      )

      const reader = response.body.getReader()

      const decoder = new TextDecoder()

      let currentText = ""
      let sentenceBuffer = ""

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, {
          stream: true,
        })

        for (const char of chunk) {
          currentText += char
          sentenceBuffer += char

          setMessages((prev) => {
            const updated = [...prev]

            updated[
              updated.length - 1
            ].text = currentText

            return updated
          })

          if (
            /[.!?]/.test(char) &&
            sentenceBuffer.trim().length > 20
          ) {
            speakText(sentenceBuffer.trim())
            sentenceBuffer = ""
          }

          await new Promise((resolve) =>
            setTimeout(resolve, 6)
          )
        }
      }

      if (sentenceBuffer.trim()) {
        speakText(sentenceBuffer.trim())
      }

      setIsThinking(false)

      isProcessingRef.current = false

      setTimeout(() => {
        if (!wakeMode) {
          startListening()
        }
      }, 500)
    } catch (error) {
      console.error(error)

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Backend connection failed.",
        },
      ])

      isProcessingRef.current = false
      setIsThinking(false)

      setTimeout(() => {
        if (!wakeMode) {
          startListening()
        }
      }, 500)
    }
  }

  const sendMessage = () => {
    if (!message.trim()) return

    const userMessage = message

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: userMessage,
      },
    ])

    setMessage("")

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
    }

    speechQueueRef.current = []
    isSpeechPlayingRef.current = false

    streamResponse(userMessage)
  }

  const sendAutoMessage = (voiceText) => {
    if (!voiceText.trim()) return

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: voiceText,
      },
    ])

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
    }

    speechQueueRef.current = []
    isSpeechPlayingRef.current = false

    streamResponse(voiceText)
  }

  useEffect(() => {
    startWakeWordListening()

    const emergencyStop = (event) => {
      if (event.key === "Escape") {
        cleanupAudioResources()
        setWakeMode(true)
      }
    }

    window.addEventListener(
      "keydown",
      emergencyStop
    )

    return () => {
      cleanupAudioResources()

      window.removeEventListener(
        "keydown",
        emergencyStop
      )
    }
  }, [])

  useEffect(() => {
    if (
      wakeMode &&
      !wakeRecognitionRef.current
    ) {
      startWakeWordListening()
    }
  }, [wakeMode])

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <div className="flex flex-col items-center pt-8">
        <motion.div
          animate={{
            scale: isListening
              ? [
                  1 + audioLevel / 500,
                  1.12 + audioLevel / 300,
                  1 + audioLevel / 500,
                ]
              : isSpeaking
              ? [1, 1.1, 1]
              : isThinking
              ? [1, 1.06, 1]
              : [1, 1.03, 1],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
          }}
          className={`
            w-32 h-32 rounded-full
            ${
              isListening
                ? "bg-orange-400 shadow-[0_0_120px_#fb923c]"
                : isSpeaking
                ? "bg-orange-500 shadow-[0_0_100px_#f97316]"
                : isThinking
                ? "bg-amber-400 shadow-[0_0_140px_#fbbf24]"
                : "bg-orange-300 shadow-[0_0_60px_#fdba74]"
            }
          `}
        />

        <div className="text-gray-500 text-xs mt-4 tracking-widest">
          STATE: {appState}
        </div>

        {wakeMode && (
          <div className="text-orange-300 mt-2 animate-pulse">
            Say “Hey Lucy”
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${
              msg.sender === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div
              className={`p-4 rounded-2xl max-w-xl ${
                msg.sender === "user"
                  ? "bg-cyan-500"
                  : "bg-gray-800"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-800 flex gap-3">
        <input
          type="text"
          placeholder="Ask Lucy..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 bg-gray-900 rounded-xl px-4 py-3 outline-none"
        />

        <button
          onClick={startListening}
          className="p-3 bg-gray-800 rounded-xl"
        >
          <Mic size={20} />
        </button>

        <button
          onClick={sendMessage}
          className="p-3 bg-orange-500 rounded-xl"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  )
}

export default App