import fs from 'node:fs'
import { PassThrough } from 'node:stream'
import { createReadableStreamFromReadable, type DataFunctionArgs } from '@remix-run/node'
import { db } from '#app/utils/db.server.js'
import { invariantResponse } from '#app/utils/misc.js'

export async function loader({ params }: DataFunctionArgs) {
    invariantResponse(params.imageId, 'Invalid Image ID');

    const image = db.image.findFirst({
        where: { id: { equals: params.imageId }}
    });

    invariantResponse(image, 'Image Not Found', { status: 404 });

    const { filePath, contentType } = image;
    const fileStat = await fs.promises.stat(filePath);
    const body = new PassThrough()
    const stream = fs.createReadStream(filePath);

    stream.on('open', () => stream.pipe(body))
    stream.on('error', err => body.end(err))
    stream.on('end', () => body.end())

    return new Response(createReadableStreamFromReadable(body), {
        status: 200,
        headers: {
            'content-type': contentType,
            'content-length': fileStat.size.toString(),
            'content-disposition': `inline; filename="${params.imageId}"`,
            'cache-control': 'public, max-age=35136000, immutable'
        }
    })
}