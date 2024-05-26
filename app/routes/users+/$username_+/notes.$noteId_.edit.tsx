import { parse } from '@conform-to/zod'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { Form, useLoaderData, useActionData } from '@remix-run/react'
import { useEffect, useId, useState, useRef } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { StatusButton } from '#app/components/ui/status-button.js'
import { TextArea } from '#app/components/ui/textarea.tsx'
import { db, updateNote } from '#app/utils/db.server.ts'
import { invariantResponse, useIsSubmitting, useFocusInvalid } from '#app/utils/misc.tsx'

export async function loader({ params }: DataFunctionArgs) {
    const note = db.note.findFirst({
        where: {
            id: {
                equals: params.noteId
            }
        }
    })

    invariantResponse(note, 'Note not found', { status: 404 })

    return json({
        note: { title: note.title, content: note.content }
    })
}

const titleMaxLength = 1000
const contentMaxLength = 10000

const NoteEditorSchema = z.object({
    title: z.string().min(1).max(titleMaxLength),
    content: z.string().min(1).max(contentMaxLength)
})

// aksi yang dikirimkan form
export async function action({ params, request }: DataFunctionArgs) {
    invariantResponse(params.noteId, 'noteId param is required!')
    
    const formData = await request.formData();

    const submission = parse(formData, {
        schema: NoteEditorSchema
    });

    if(!submission.value) {
        return json({ status: 'error', submission } as const, { status: 400 })
    }

    const { title, content } = submission.value
    await updateNote({ id: params.noteId, title, content })


    return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

function ErrorList({ errors, id }: { errors?: Array<string> | null, id?: string }) {
    return errors?.length ? (
        <ul className='flex flex-col gap-1' id={id}>
            {errors.map((error, i) => (
                <li key={i} className='text-[10px] text-red-500'>
                    {error}
                </li>
            ))}
        </ul>
    ) : null
}

function useHydrate() {
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => setHydrated(true), [])
    return hydrated
}

export default function NoteEdit() {
    const data = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const isSubmitting = useIsSubmitting();
    const formId = 'note-editor';
    const formRef = useRef<HTMLFormElement>(null)
    const titleId = useId();

	const fieldErrors = actionData?.status === 'error' ? actionData.submission.error : null
	const formErrors = actionData?.status === 'error' ? actionData.submission.error[''] : null

    const isHydrated = useHydrate()

    const formHasErrors = Boolean(formErrors?.length);
    const formErrorId = formHasErrors ? 'form-error' : undefined

    const titleHasErrors = Boolean(fieldErrors?.title?.length);
    const titleErrorId = titleHasErrors ? 'title-error' : undefined

    const contentHasErrors = Boolean(fieldErrors?.content?.length);
    const contentErrorId = contentHasErrors ? 'content-error' : undefined

    useFocusInvalid(
        formRef.current,
        actionData?.status === 'error' && !isSubmitting
    );

    return (
        <div className="absolute inset-0">
            <Form
                id={formId}
                method="POST"
                className="flex h-full flex-col gap-y-4 overflow-x-hidden px-10 pb-28 pt-12"
                noValidate={isHydrated}
                aria-invalid={formHasErrors || undefined}
                aria-describedby={formErrorId}
                ref={formRef}
            >
                <div className='flex flex-col gap-1'>
                    <div>
                        <Label htmlFor={titleId}>Title</Label>
                        <Input id={titleId} name="title" defaultValue={data.note.title} required maxLength={titleMaxLength} aria-invalid={titleHasErrors || undefined} aria-describedby={titleErrorId} autoFocus/>
                        <div className="min-h-[32px] px-4 pb-3 pt-1">
                            <ErrorList id={titleErrorId} errors={fieldErrors?.title}/>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor='content-input'>Content</Label>
                        <TextArea id='content-input' name="content" defaultValue={data.note.content} required maxLength={contentMaxLength} aria-invalid={contentHasErrors || undefined} aria-describedby={contentErrorId}/>
                        <div className="min-h-[32px] px-4 pb-3 pt-1">
                            <ErrorList id={contentErrorId} errors={fieldErrors?.content}/>
                        </div>
                    </div>
                </div>
                <div className='min-h-[32px] px-4 pb-3 pt-1'>
                    <ErrorList errors={formErrors}/>
                </div>
                <div className={floatingToolbarClassName}>
                    <Button variant="destructive" type="reset" form={formId}>
                        Reset
                    </Button>
                    <StatusButton
                        form={formId}
                        type="submit"
                        disabled={isSubmitting}
                        status={isSubmitting ? 'pending' : 'idle'}
                    >Submit</StatusButton>
                </div>
            </Form>
        </div>
    )
}

export function ErrorBoundary() {
    return (
        <GeneralErrorBoundary
            statusHandlers={{
                404: ({ params }) => {
                    return <p>No note with the id {params.noteId}</p>
                }
            }}
        />
    )
}