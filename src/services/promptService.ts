import { GoogleGenAI, Type } from "@google/genai";

export interface GeneratedPrompts {
  imagePrompt?: string;
  videoPrompt?: string;
  explanation: string;
}

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export async function transcribeAudio(base64Audio: string, mimeType: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: mimeType
            }
          },
          { text: "Transcribe this audio accurately. Only return the transcription text, nothing else." }
        ]
      }
    ]
  });

  return response.text || "";
}

export async function generateDetailedPrompts(userIdea: string, style: string, mood: string, aspectRatio: string, targetType: 'image' | 'video' | 'both'): Promise<GeneratedPrompts> {
  const ai = getAI();
  const targetInstruction = targetType === 'image' 
    ? "Generate ONLY a highly detailed image prompt." 
    : targetType === 'video' 
    ? "Generate ONLY a highly detailed video prompt." 
    : "Generate two highly detailed prompts: one for image generation and one for video generation.";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Expand the following idea into detailed prompts.
    
    User Idea: ${userIdea}
    Style: ${style}
    Mood: ${mood}
    Aspect Ratio: ${aspectRatio}
    Target: ${targetType}
    
    ${targetInstruction}
    
    The image prompt (if requested) should focus on composition, lighting, textures, and specific visual details.
    The video prompt (if requested) should focus on movement, temporal changes, camera motion, and cinematic flow.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          imagePrompt: { type: Type.STRING, description: "Detailed prompt for image generation (optional if only video requested)" },
          videoPrompt: { type: Type.STRING, description: "Detailed prompt for video generation (optional if only image requested)" },
          explanation: { type: Type.STRING, description: "Brief explanation of the artistic choices made" }
        },
        required: ["explanation"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to generate prompts. Please try again.");
  }
}

export async function generatePromptsFromImage(base64Image: string, mimeType: string, style: string, aspectRatio: string, targetType: 'image' | 'video' | 'both'): Promise<GeneratedPrompts> {
  const ai = getAI();
  const targetInstruction = targetType === 'image' 
    ? "Generate ONLY a highly detailed image prompt based on this image." 
    : targetType === 'video' 
    ? "Generate ONLY a highly detailed video prompt based on this image." 
    : "Generate two highly detailed prompts based on this image: one for image generation and one for video generation.";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType
            }
          },
          { 
            text: `Analyze this image and generate detailed prompts.
            
            Requested Style: ${style}
            Requested Aspect Ratio: ${aspectRatio}
            Target: ${targetType}
            
            ${targetInstruction}` 
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          imagePrompt: { type: Type.STRING, description: "Detailed prompt for image generation" },
          videoPrompt: { type: Type.STRING, description: "Detailed prompt for video generation" },
          explanation: { type: Type.STRING, description: "Brief explanation of the artistic choices made" }
        },
        required: ["explanation"]
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to generate prompts. Please try again.");
  }
}
