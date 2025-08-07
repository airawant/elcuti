import Image from "next/image";
import { Linkedin, Mail } from "lucide-react";
export const metadata = {
  title: "Tim Programmer | ElCuti Kemenag",
  description: "Profil programmer dan developer di El-Cuti Kementerian Agama",
};

export default function ProgrammerPage() {
  const programmers = [
    {
      id: 1,
      name: "M. Arief Irawan T., S.T.",
      title: "Analis/Programmer/QA",
      jabatan: "Pranata Komputer Ahli Pertama",
      image: "/images/profile.jpg",
      linkedin: "https://www.linkedin.com/in/arief-irawan-4a0803208/",
      email: "ariefirawant@gmail.com",
    },
  ];

  return (
    <>
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <header className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Pengembang
            </h1>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-12 place-items-center">
            {programmers.map((person) => (
              <div
                key={person.id}
                className="bg-white rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105"
              >
                <div className="relative h-72 w-96">
                  <Image
                    src={person.image}
                    alt={person.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-800">{person.name}</h2>
                  <p className="font-medium mb-3">{person.jabatan}</p>
                  <p className="text-blue-600 font-medium mb-3">{person.title}</p>

                  <div className="flex space-x-4">
                    <a
                      href={person.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-full transition"
                      aria-label={`LinkedIn ${person.name}`}
                    >
                      <Linkedin className="w-5 h-5" />
                    </a>
                    {/* <a
                      href={person.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full transition"
                      aria-label={`GitHub ${person.name}`}
                    >
                      <Github className="w-5 h-5" />
                    </a> */}
                    <a
                      href={`mailto:${person.email}`}
                      className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-full transition"
                      aria-label={`Email ${person.name}`}
                    >
                      <Mail className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
