# Course Materials and Repository Boundary

## Purpose

Engineering ML Studio supports self-directed learning and instructor-led training.
The public platform repository and the private course repository have separate
responsibilities. This boundary keeps the platform reusable while allowing
course materials to be developed and maintained independently.

## What belongs in this repository

This public repository contains the Engineering ML Studio platform and resources
that are intended to be reusable by its users, regardless of which course or
institution they belong to.

Examples include:

- Application source code, user-interface features and platform functionality.
- Technical documentation, development instructions and project documentation.
- Reusable engineering examples and datasets, with appropriate provenance and
  licensing information.
- Reusable learning resources that demonstrate platform capabilities, such as
  the Python notebook in `notebooks/`.
- Automated tests and supporting development tools.

A resource does not become private course material simply because it has
educational value or is useful during teaching.

## What belongs in the private course repository

The separate private course repository contains materials created specifically
to deliver, support or assess a training course.

Examples include:

- Course curricula, syllabuses and lesson plans.
- Course schedules and teaching plans.
- Instructor guidance, presentation slides and teaching notes.
- Course-specific exercises, worksheets and practical activities.
- Exercise solutions, assessment questions, marking schemes and assessment
  materials.
- Other course-specific resources prepared for instructors or enrolled learners.

These materials are not part of the public Engineering ML Studio repository
and are not covered by its software licence.

## Applying the boundary

When deciding where a new resource belongs, consider its primary purpose:

- If it develops, documents, tests or demonstrates a reusable platform
  capability, it belongs in the public platform repository.
- If it supports the delivery or assessment of a particular course, it belongs
  in the private course repository.

Where a resource serves both purposes, keep the reusable platform component
in the public repository and the course-specific teaching material in the
private repository. Link between them where appropriate rather than copying
course materials into the public project.

## Licensing and project identity

The public repository's licensing and attribution requirements remain in force.
Third-party components and inherited materials retain their applicable notices
and licence terms.

The Engineering ML Studio name and logo are not licensed by the software
licence. See the repository's README and Apache-2.0 licence for the existing
project identity and licensing statements.

Course materials are maintained separately. Any access controls or licensing
for those materials must be managed outside this repository.
