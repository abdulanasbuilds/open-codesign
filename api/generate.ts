import { complete } from '@open-codesign/providers';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { model, messages, opts } = req.body;

  try {
    const result = await complete(model, messages, opts || { apiKey: '' });
    const wrappedResult = {
      message: '',
      artifacts: [
        {
          id: `art-${Date.now()}`,
          type: 'html',
          title: 'Generated Design',
          content: result.content,
          designParams: [],
          sourceFormat: 'html',
          renderRuntime: 'static-html',
          createdAt: new Date().toISOString()
        }
      ],
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd
    };
    return res.status(200).json(wrappedResult);
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(error.code === 'PROVIDER_AUTH_MISSING' ? 401 : 500).json({
      error: error.message,
      code: error.code
    });
  }
}
