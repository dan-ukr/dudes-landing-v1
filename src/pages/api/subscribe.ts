import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const email = formData.get('email')?.toString();
    const lang = formData.get('lang')?.toString() || 'en';

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Bro, enter a real email' }), { status: 400 });
    }

    // Отримуємо доступ до D1 через locals
    const { DB } = locals.runtime.env;

    await DB.prepare('INSERT INTO emails (email, lang) VALUES (?, ?)')
      .bind(email, lang)
      .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return new Response(JSON.stringify({ error: 'You are already in, bro!' }), { status: 400 });
    }
    return new Response(JSON.stringify({ error: 'Database error, try later' }), { status: 500 });
  }
};