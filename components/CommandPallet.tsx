"use client";

import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogPanel,
  DialogBackdrop,
} from "@headlessui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import {
  ExclamationTriangleIcon,
  FolderIcon,
  LifebuoyIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

const projects = [
  {
    id: 1,
    name: "Workflow Inc. / Website Redesign",
    category: "Projects",
    url: "#",
  },
  // More projects...
];

const users = [
  {
    id: 1,
    name: "Leslie Alexander",
    url: "#",
    imageUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  },
  // More users...
];

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Example() {
  const [open, setOpen] = useState(true);
  const [rawQuery, setRawQuery] = useState("");
  const query = rawQuery.toLowerCase().replace(/^[#>]/, "");

  const filteredProjects =
    rawQuery === "#"
      ? projects
      : query === "" || rawQuery.startsWith(">")
        ? []
        : projects.filter((project) =>
            project.name.toLowerCase().includes(query),
          );

  const filteredUsers =
    rawQuery === ">"
      ? users
      : query === "" || rawQuery.startsWith("#")
        ? []
        : users.filter((user) => user.name.toLowerCase().includes(query));

  return (
    <Dialog
      className="relative z-10"
      open={open}
      onClose={() => {
        setOpen(false);
        setRawQuery("");
      }}
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-900/50 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto p-4 sm:p-6 md:p-20">
        <DialogPanel
          transition
          className="mx-auto max-w-xl transform divide-y divide-white/10 overflow-hidden rounded-xl bg-gray-900 shadow-2xl outline-1 -outline-offset-1 outline-white/10 transition-all data-closed:scale-95 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        >
          <Combobox
            onChange={(item) => {
              if (item) {
                window.location = item.url;
              }
            }}
          >
            <div className="grid grid-cols-1">
              <ComboboxInput
                autoFocus
                className="col-start-1 row-start-1 h-12 w-full bg-gray-900 pr-4 pl-11 text-base text-white outline-hidden placeholder:text-gray-500 sm:text-sm"
                placeholder="Search..."
                onChange={(event) => setRawQuery(event.target.value)}
                onBlur={() => setRawQuery("")}
              />
              <MagnifyingGlassIcon
                className="pointer-events-none col-start-1 row-start-1 ml-4 size-5 self-center text-gray-500"
                aria-hidden="true"
              />
            </div>

            {(filteredProjects.length > 0 || filteredUsers.length > 0) && (
              <ComboboxOptions
                static
                as="ul"
                className="max-h-80 transform-gpu scroll-py-10 scroll-pb-2 space-y-4 overflow-y-auto p-4 pb-2"
              >
                {filteredProjects.length > 0 && (
                  <li>
                    <h2 className="text-xs font-semibold text-white">
                      Projects
                    </h2>
                    <ul className="-mx-4 mt-2 text-sm text-gray-300">
                      {filteredProjects.map((project) => (
                        <ComboboxOption
                          as="li"
                          key={project.id}
                          value={project}
                          className="group flex cursor-default items-center px-4 py-2 select-none data-focus:bg-indigo-500 data-focus:text-white data-focus:outline-hidden"
                        >
                          <FolderIcon
                            className="size-6 flex-none text-gray-500 group-data-focus:text-white forced-colors:group-data-focus:text-[Highlight]"
                            aria-hidden="true"
                          />
                          <span className="ml-3 flex-auto truncate">
                            {project.name}
                          </span>
                        </ComboboxOption>
                      ))}
                    </ul>
                  </li>
                )}
                {filteredUsers.length > 0 && (
                  <li>
                    <h2 className="text-xs font-semibold text-white">Users</h2>
                    <ul className="-mx-4 mt-2 text-sm text-gray-300">
                      {filteredUsers.map((user) => (
                        <ComboboxOption
                          as="li"
                          key={user.id}
                          value={user}
                          className="flex cursor-default items-center px-4 py-2 select-none data-focus:bg-indigo-500 data-focus:text-white"
                        >
                          <img
                            src={user.imageUrl}
                            alt=""
                            className="size-6 flex-none rounded-full bg-gray-800 outline -outline-offset-1 outline-white/10"
                          />
                          <span className="ml-3 flex-auto truncate">
                            {user.name}
                          </span>
                        </ComboboxOption>
                      ))}
                    </ul>
                  </li>
                )}
              </ComboboxOptions>
            )}

            {rawQuery === "?" && (
              <div className="px-6 py-14 text-center text-sm sm:px-14">
                <LifebuoyIcon
                  className="mx-auto size-6 text-gray-500"
                  aria-hidden="true"
                />
                <p className="mt-4 font-semibold text-white">
                  Help with searching
                </p>
                <p className="mt-2 text-gray-400">
                  Use this tool to quickly search for users and projects across
                  our entire platform. You can also use the search modifiers
                  found in the footer below to limit the results to just users
                  or projects.
                </p>
              </div>
            )}

            {query !== "" &&
              rawQuery !== "?" &&
              filteredProjects.length === 0 &&
              filteredUsers.length === 0 && (
                <div className="px-6 py-14 text-center text-sm sm:px-14">
                  <ExclamationTriangleIcon
                    className="mx-auto size-6 text-gray-400"
                    aria-hidden="true"
                  />
                  <p className="mt-4 font-semibold text-white">
                    No results found
                  </p>
                  <p className="mt-2 text-gray-400">
                    We couldn’t find anything with that term. Please try again.
                  </p>
                </div>
              )}

            <div className="flex flex-wrap items-center bg-gray-800/50 px-4 py-2.5 text-xs text-gray-300">
              Type{" "}
              <kbd
                className={classNames(
                  "mx-1 flex size-5 items-center justify-center rounded-sm border bg-gray-800 font-semibold sm:mx-2",
                  rawQuery.startsWith("#")
                    ? "border-indigo-500 text-indigo-500"
                    : "border-white/10 text-white",
                )}
              >
                #
              </kbd>{" "}
              <span className="sm:hidden">for projects,</span>
              <span className="hidden sm:inline">to access projects,</span>
              <kbd
                className={classNames(
                  "mx-1 flex size-5 items-center justify-center rounded-sm border bg-gray-800 font-semibold sm:mx-2",
                  rawQuery.startsWith(">")
                    ? "border-indigo-500 text-indigo-500"
                    : "border-white/10 text-white",
                )}
              >
                &gt;
              </kbd>{" "}
              for users, and{" "}
              <kbd
                className={classNames(
                  "mx-1 flex size-5 items-center justify-center rounded-sm border bg-gray-800 font-semibold sm:mx-2",
                  rawQuery === "?"
                    ? "border-indigo-500 text-indigo-500"
                    : "border-white/10 text-white",
                )}
              >
                ?
              </kbd>{" "}
              for help.
            </div>
          </Combobox>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
