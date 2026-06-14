import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cmd = searchParams.get('cmd');
  if (!cmd) {
    return NextResponse.json({ error: 'No command provided' }, { status: 400 });
  }
  
  try {
    const cwd = searchParams.get('cwd') || 'c:\\Users\\harsh\\face new\\facesnap\\backend';
    const { stdout, stderr } = await execAsync(cmd, { cwd });
    return NextResponse.json({ stdout, stderr });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
    }, { status: 500 });
  }
}
