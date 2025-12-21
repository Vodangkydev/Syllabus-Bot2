"""
Hugging Face Inference API LLM wrapper with streaming support
"""
import os
import requests
import json
import asyncio
from typing import AsyncIterator, Optional


class HuggingFaceLLM:
    """Hugging Face Inference API LLM wrapper with streaming support"""
    
    def __init__(self, model: str = "AITeamVN/GRPO-VI-Qwen2-7B-RAG:featherless-ai", 
                 api_token: Optional[str] = None,
                 timeout: int = 30,
                 temperature: float = 0.01):
        self.api_url = "https://router.huggingface.co/v1/chat/completions"
        self.model = model
        self.api_token = api_token or os.environ.get('HF_TOKEN')
        self.timeout = timeout
        self.temperature = temperature
        
        if not self.api_token:
            raise ValueError("Hugging Face API token is required. Set HF_TOKEN environment variable or pass api_token parameter.")
    
    def _get_headers(self):
        """Get headers for API request"""
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
    
    async def astream(self, prompt: str) -> AsyncIterator[str]:
        """Stream response from Hugging Face Inference API"""
        # Convert prompt to messages format
        messages = [
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        payload = {
            "messages": messages,
            "model": self.model,
            "temperature": self.temperature,
            "stream": True
        }
        
        try:
            # Make streaming request
            response = requests.post(
                self.api_url,
                headers=self._get_headers(),
                json=payload,
                stream=True,
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                error_msg = f"API request failed with status {response.status_code}: {response.text}"
                yield error_msg
                return
            
            # Process streaming response
            for line in response.iter_lines():
                if not line:
                    continue
                
                # Decode line
                line_text = line.decode('utf-8')
                
                # Skip non-data lines
                if not line_text.startswith('data: '):
                    continue
                
                # Remove 'data: ' prefix
                data_str = line_text[6:]
                
                # Skip [DONE] marker
                if data_str.strip() == '[DONE]':
                    break
                
                try:
                    data = json.loads(data_str)
                    
                    # Extract content from choices
                    if 'choices' in data and len(data['choices']) > 0:
                        choice = data['choices'][0]
                        if 'delta' in choice and 'content' in choice['delta']:
                            content = choice['delta']['content']
                            if content:
                                yield content
                        elif 'message' in choice and 'content' in choice['message']:
                            content = choice['message']['content']
                            if content:
                                yield content
                except json.JSONDecodeError:
                    # Skip invalid JSON lines
                    continue
                    
        except requests.exceptions.RequestException as e:
            error_msg = f"Error calling Hugging Face API: {str(e)}"
            yield error_msg
    
    async def ainvoke(self, prompt: str) -> str:
        """Invoke LLM synchronously and return full response"""
        full_response = ""
        async for chunk in self.astream(prompt):
            full_response += chunk
        return full_response

