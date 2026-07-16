# NERVA dual-scorer shadow track.
#
# Instrumentation, not integration: this package reads kernel inputs and
# outputs, runs a second-opinion scorer (Grok) in parallel, and logs what the
# dual scorer WOULD have said. It never writes to the kernel, never alters a
# live verdict, and nothing downstream consumes its output in this phase.
# Verdicts of record come from the frozen v11.1-stable kernel only.
