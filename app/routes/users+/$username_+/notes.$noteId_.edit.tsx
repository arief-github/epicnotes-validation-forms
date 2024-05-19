import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { Form, useLoaderData, useNavigation, useFormAction, useActionData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { StatusButton } from '#app/components/ui/status-button.js'
import { TextArea } from '#app/components/ui/textarea.tsx'
import { db } from '#app/utils/db.server.ts'
import { invariantResponse } from '#app/utils/misc.tsx'

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

// aksi yang dikirimkan form
export async function action({ params, request }: DataFunctionArgs) {
    const formData = await request.formData();

    const title = formData.get('title');
    const content = formData.get('content');

    invariantResponse(typeof title === 'string', 'title is required', { status: 400 })
    invariantResponse(typeof content === 'string', 'content is required', { status: 400 })

    const errors = {
        formErrors: [] as Array<string>,
        fieldErrors: {
            title: [] as Array<string>,
            content: [] as Array<string>,
        }
    }

    if(title === '') {
        errors.fieldErrors.title.push('Title is Required');
    }

    if(title.length > titleMaxLength) {
        errors.fieldErrors.title.push(`Title must be ${titleMaxLength} character or less`);
    }

    if(content === '') {
        errors.fieldErrors.content.push('Content is Required');
    }

    if(content.length > contentMaxLength) {
        errors.fieldErrors.title.push(`Content must be ${contentMaxLength} character or less`);
    }

    const hasErrors = errors.formErrors.length > 0 || Object.values(errors.fieldErrors).some(fieldErrors => fieldErrors.length > 0)

    if(hasErrors) {
        return json({ errors }, {
            status: 400
        })
    }

    db.note.update({
        where: { id: { equals: params.noteId } },
        data: { title, content },
    })

    return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

function ErrorList({ errors }: { errors?: Array<string> | null }) {
    return errors?.length ? (
        <ul className='flex flex-col gap-1'>
            {errors.map((error, i) => (
                <li key={i} className='text-[10px] text-red-500'>
                    {error}
                </li>
            ))}
        </ul>
    ) : null
}

export default function NoteEdit() {
    const data = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const navigation = useNavigation();
    const formAction = useFormAction();
    const isSubmitting = navigation.state !== 'idle' && navigation.formMethod === 'POST' && navigation.formAction === formAction

    const fieldErrors = actionData?.status === 'error' ? actionData.errors.fieldErrors : null
    const formErrors = actionData?.errors?.formErrors ?? null

    return (
        <Form
            method="POST"
            className="flex h-full flex-col gap-y-4 overflow-x-hidden px-10 pb-28 pt-12"
            noValidate
        >
            <div className='flex flex-col gap-1'>
                <div>
                    {/* 🦉 NOTE: this is not an accessible label, we'll get to that in the accessibility exercises */}
                    <Label>Title</Label>
                    <Input name="title" defaultValue={data.note.title} required maxLength={titleMaxLength}/>
                    <div className="min-h-[32px] px-4 pb-3 pt-1">
                        <ErrorList errors={fieldErrors?.title}/>
                    </div>
                </div>
                <div>
                    {/* 🦉 NOTE: this is not an accessible label, we'll get to that in the accessibility exercises */}
                    <Label>Content</Label>
                    <TextArea name="content" defaultValue={data.note.content} required maxLength={contentMaxLength}/>
                    <div className="min-h-[32px] px-4 pb-3 pt-1">
                        <ErrorList errors={fieldErrors?.content}/>
                    </div>
                </div>
            </div>
            <div className='min-h-[32px] px-4 pb-3 pt-1'>
                <ErrorList errors={formErrors}/>
            </div>
            <div className={floatingToolbarClassName}>
                <Button variant="destructive" type="reset">
                    Reset
                </Button>
                <StatusButton
                    type="submit"
                    disabled={isSubmitting}
                    status={isSubmitting ? 'pending' : 'idle'}
                >Submit</StatusButton>
            </div>
        </Form>
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