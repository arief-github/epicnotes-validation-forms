import { json, type DataFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.js'
import { db } from '#app/utils/db.server.ts'
import { invariantResponse } from '#app/utils/misc.js'

export async function loader({ params }: DataFunctionArgs) {
    const user = db.user.findFirst({
        where: {
            username: {
                equals: params.username,
            },
        },
    })

    invariantResponse(user, 'user not found', { status: 404, statusText: 'User not found' })

    return json({
        user: { name: user?.name, username: user?.username },
    })
}

export default function KodiProfileRoute() {
    const data = useLoaderData<typeof loader>()
    return (
        <div className="container mb-48 mt-36">
            <h1 className="text-h1">{data?.user?.name ?? data.user.username}</h1>
            <Link to="notes" className="underline" prefetch='intent'>
                Notes
            </Link>
        </div>
    )
}

/**
 * Calculate metadata based on user data and parameters.
 *
 * @param {Object} data - The data object containing user information.
 * @param {Object} params - The parameters object containing username.
 * @return {Array} An array of metadata items including title and description.
 */
export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.name ?? params.username
    
    return [
		{ title: `${displayName} | Epic Notes` },
		{ name: 'description', content: `Checkout ${displayName} on Epic Notes notes` }
	]
}

export function ErrorBoundary() {
    return (
        <GeneralErrorBoundary
            statusHandlers={{
                404: ({ params }) => <p>User "{params.username}" not found</p>,
            }}
        />
    )
}




