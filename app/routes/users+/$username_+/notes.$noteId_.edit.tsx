import { type FieldConfig, conform, useFieldset, useForm } from '@conform-to/react'
import { parse, getFieldsetConstraint } from '@conform-to/zod'
import { json,
         redirect, 
         unstable_createMemoryUploadHandler as createMemoryUploadHandler, 
         unstable_parseMultipartFormData as parseMultipartFormData,
        type DataFunctionArgs } from '@remix-run/node'
import { Form, useLoaderData, useActionData } from '@remix-run/react'
import { useRef, useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { StatusButton } from '#app/components/ui/status-button.js'
import { TextArea } from '#app/components/ui/textarea.tsx'
import { db, updateNote } from '#app/utils/db.server.ts'
import { cn, invariantResponse, useIsSubmitting } from '#app/utils/misc.tsx'

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
        note: { title: note.title, content: note.content, images: note.images.map(img => ({ id: img.id, altText: img.altText })) }
    })
}

const titleMaxLength = 1000
const contentMaxLength = 10000
const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3mb

const ImageFieldsetSchema = z.object({
    id: z.string().optional(),
    file: z
    .instanceof(File)
    .refine(file => {
        return file.size <= MAX_UPLOAD_SIZE
    }, 'File size must be less than 3MB')
    .optional(),
    altText: z.string().optional(),
})

const NoteEditorSchema = z.object({
	title: z.string().max(titleMaxLength),
	content: z.string().max(contentMaxLength),
	image: ImageFieldsetSchema,
})

// aksi yang dikirimkan form
export async function action({ params, request }: DataFunctionArgs) {
    invariantResponse(params.noteId, 'noteId param is required!')
    
    const formData = await parseMultipartFormData(request, createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE }))

    const submission = parse(formData, {
        schema: NoteEditorSchema
    });

    if(!submission.value) {
        return json({ status: 'error', submission } as const, { status: 400 })
    }

    const { title, content, image } = submission.value

	await updateNote({
		id: params.noteId,
		title,
		content,
		images: [image],
	})

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

export default function NoteEdit() {
    const data = useLoaderData<typeof loader>()
    const actionData = useActionData<typeof action>()
    const isSubmitting = useIsSubmitting();

    const [form, fields] = useForm({
        id: 'note-editor',
        constraint: getFieldsetConstraint(NoteEditorSchema),
        lastSubmission: actionData?.submission,
        onValidate({ formData }) {
            return parse(formData, { schema: NoteEditorSchema })
        },
        defaultValue: {
            title: data.note.title,
            content: data.note.content,
            image: data.note.images[0],
        }
    })

    return (
        <div className="absolute inset-0">
            <Form
                method="POST"
                className="flex h-full flex-col gap-y-4 overflow-x-hidden px-10 pb-28 pt-12"
                {...form.props}
                encType='multipart/form-data'
                >
                <div className='flex flex-col gap-1'>
                    <div>
                        <Label htmlFor={fields.title.id}>Title</Label>
                        <Input autoFocus {...conform.input(fields.title)}/>
                        <div className="min-h-[32px] px-4 pb-3 pt-1">
                            	<ErrorList
								    id={fields.title.errorId}
								    errors={fields.title.errors}
							    />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor={fields.content.id}>Content</Label>
                        <TextArea {...conform.textarea(fields.content)}/>
                        <div className="min-h-[32px] px-4 pb-3 pt-1">
                            <ErrorList
								id={fields.content.errorId}
								errors={fields.content.errors}
							/>
                        </div>
                    </div>
                    <div>
                        <Label>Image</Label>
                        <ImageChooser config={fields.image}/>
                    </div>
                </div>
                <div className='min-h-[32px] px-4 pb-3 pt-1'>
                    <ErrorList id={form.errorId} errors={form.errors} />
                </div>
                <div className={floatingToolbarClassName}>
                    <Button variant="destructive" type="reset" form={form.id}>
                        Reset
                    </Button>
                    <StatusButton
                        form={form.id}
                        type="submit"
                        disabled={isSubmitting}
                        status={isSubmitting ? 'pending' : 'idle'}
                    >Submit</StatusButton>
                </div>
            </Form>
        </div>
    )
}

function ImageChooser({ config }: { config: FieldConfig<z.infer<typeof ImageFieldsetSchema>> }) {
    const ref = useRef<HTMLFieldSetElement>(null)
    const fields = useFieldset(ref, config)
   
    const existingImage = Boolean(fields.id.defaultValue)
    const [previewImage, setPreviewImage] = useState<string | null>(existingImage ? `/resources/images/${fields.id.defaultValue}` : null)
    const [altText, setAltText] = useState(fields.altText.defaultValue ?? '')

    return (
        <fieldset>
            <div className='w-32'>
                <div className='relative h-32 w-32'>
                        <label
							htmlFor="image-input"
							className={cn('group absolute h-32 w-32 rounded-lg', {
								'bg-accent opacity-40 focus-within:opacity-100 hover:opacity-100':
									!previewImage,
								'cursor-pointer focus-within:ring-4': !existingImage,
							})}
						>
							{previewImage ? (
								<div className="relative">
									<img
										src={previewImage}
										alt={altText ?? ''}
										className="h-32 w-32 rounded-lg object-cover"
									/>
									{existingImage ? null : (
										<div className="pointer-events-none absolute -right-0.5 -top-0.5 rotate-12 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md">
											new
										</div>
									)}
								</div>
							) : (
								<div className="flex h-32 w-32 items-center justify-center rounded-lg border border-muted-foreground text-4xl text-muted-foreground">
									➕
								</div>
							)}
							{existingImage ? (
								<input {...conform.input(fields.id, { type: 'hidden' })} />
							) : null}
							<input
								id="image-input"
								aria-label="Image"
								className="absolute left-0 top-0 z-0 h-32 w-32 cursor-pointer opacity-0"
								onChange={event => {
									const file = event.target.files?.[0]

									if (file) {
										const reader = new FileReader()
										reader.onloadend = () => {
											setPreviewImage(reader.result as string)
										}
										reader.readAsDataURL(file)
									} else {
										setPreviewImage(null)
									}
								}}
								accept="image/*"
                                {...conform.input(fields.file, { type: 'file' })}
                            />
						</label>
                </div>
            </div>
            <div className='flex-1'>
                <Label htmlFor='alt-text'>Alt Text</Label>
                <TextArea
                    onChange={e => setAltText(e.currentTarget.value)}
                    {...conform.textarea(fields.altText)}           
                />
            </div>
        </fieldset>
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