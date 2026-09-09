export function speechAvailable() {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}
export function recognize(
  language: "en" | "kn",
  onText: (text: string) => void,
  onError: (text: string) => void,
) {
  const Recognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!Recognition) {
    onError(
      "Speech recognition is unsupported in this browser. Type your question.",
    );
    return null;
  }
  const recognition = new Recognition();
  recognition.lang = language === "kn" ? "kn-IN" : "en-IN";
  recognition.continuous = false;
  recognition.onresult = (event: any) => onText(event.results[0][0].transcript);
  recognition.onerror = (event: any) =>
    onError(`Speech recognition: ${event.error}`);
  recognition.start();
  return recognition;
}
export function speak(text: string, language: "en" | "kn") {
  if (!("speechSynthesis" in window))
    throw new Error("Text-to-speech is unsupported in this browser.");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === "kn" ? "kn-IN" : "en-IN";
  speechSynthesis.speak(utterance);
}
