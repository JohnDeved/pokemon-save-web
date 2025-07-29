# Copilot Instructions

always check for code issues and errors after making any changes.  
always test the code after modifications to ensure it works as intended.  
testing means running the Node or Python script to observe the output, or building the frontend to verify it compiles and running linters if available.
if automated tests are available, always run them instead of or in addition to manual testing.
if you encounter an error, it is ALWAYS your responsibility to fix it.  
do not ask obvious questions like "would you like me to fix that?" — the answer is always yes.  
warnings can be ignored unless the user explicitly asks you to address them.  
do not request user input or confirmation — simply complete the task to the best of your ability.  
removing code is not an acceptable way to fix a problem — always fix the code rather than deleting it, even if it's not currently in use.  
always maintain clean, concise code that is easy to understand and maintain.  
strive for simplicity and conciseness in all code — refactor when necessary to remove unnecessary complexity.  
ensure the use of modern APIs and follow best practices at all times.  
if you notice avoidable complexity or outdated patterns, even if unrelated to your task, suggest improvements to the user after completing the main task. Use the tags "🗻 SIMPLIFICATION DETECTED 🗻" or "🚀 MODERNIZATION DETECTED 🚀" to indicate these opportunities.  
work independently. never wait for user input or confirmation. if the user wishes to stop you, they will do so themselves.
do not create vscode tasks unprompted.
always view whole files, not just snippets, to understand the context of the code you are working on.
before replacing or modifying code, ensure you understand the entire file to avoid bad and broken replacements.

## Code Quality and Performance Rules

PERFORMANCE: optimize for speed and memory efficiency in all code changes.
SIMPLICITY: prefer simple, readable solutions over clever or complex ones.
CONCISENESS: write minimal code that achieves the goal without sacrificing clarity.
MAINTAINABILITY: structure code to be easily understood and modified by future developers.
VALIDATION: always test performance-critical changes with appropriate benchmarks when modifying hot paths.
RELIABILITY: prioritize stable, predictable behavior over experimental or cutting-edge approaches.
SCALABILITY: consider how code changes will perform under increased load or data volume.
COMPLEXITY_REDUCTION: actively identify and eliminate unnecessary complexity in code structures.
READABILITY: code must be self-documenting and easily understood by developers of varying experience levels.
MINIMAL_DEPENDENCIES: avoid adding new dependencies unless absolutely necessary for core functionality.
MEMORY_EFFICIENCY: minimize memory allocations and prevent memory leaks in performance-critical paths.
PERFORMANCE_MONITORING: include appropriate performance logging and monitoring in production code changes.