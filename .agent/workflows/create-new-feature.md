---
description: Create a new feature module following project architecture
---

Implementation steps for creating a new feature module in `src/features`:

1.  **Ask for Feature Name**: If the user hasn't provided a feature name in the request, ask for it. (e.g., "What is the name of the new feature?")

2.  **Create Directory Structure**:
    Create the following directories under `src/features/<feature-name>`:
    - `components`: For React components specific to this feature.
    - `hooks`: For custom React hooks.
    - `utils`: For helper functions.
    - `types`: For TypeScript type definitions.

    _Example Command_:

    ```bash
    mkdir -p src/features/<feature-name>/{components,hooks,utils,types}
    ```

3.  **Create Entry Component**:
    Create a main component file in `src/features/<feature-name>/components/<FeatureName>.tsx`.
    - Use functional component syntax.
    - Export it as default or named export.

4.  **Create Page Route (Optional)**:
    If this feature needs a page route, create it in `src/app`.
    - Ask the user for the desired route path (e.g., `/tools/<feature-name>`).
    - Create `src/app/<route-path>/page.tsx`.
    - **Crucial**: The `page.tsx` should be a **Server Component** by default.
    - Import the feature component from `src/features/<feature-name>/components/...`.

5.  **Guidelines Reminder**:
    - **Client vs Server**: Keep `page.tsx` as a Server Component. If interactivity is needed, add `"use client"` to the components inside `src/features`.
    - **Styles**: Use Tailwind CSS for styling.
