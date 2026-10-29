"""
The Zenodo files use Wikidata IRIs (wd:Q7322), but wikipedia_extractor_final.py takes the
last part of the subject/object IRI as a Wikipedia article title (it was written for the
DBpedia version of the data). This script maps every entity to its English Wikipedia title
and writes the statements back with DBpedia-style IRIs, so the extractor can be used as is.

usage: python tools/prepare_input.py data/raw/BPDP_train_reified_wikidata_final.ttl data/input/BPDP_train_reified.nt
"""
import sys
import requests
from rdflib import Graph, URIRef
from rdflib.namespace import RDF

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
HEADERS = {"User-Agent": "no-need-to-be-so-big/0.1 (university project; https://github.com/ZiarnoM/no-need-to-be-so-big)"}
WD_ENTITY = "http://www.wikidata.org/entity/"
DBR = "http://dbpedia.org/resource/"


def enwiki_titles(qids):
    titles = {}
    qids = sorted(qids)
    for i in range(0, len(qids), 50):
        params = {
            "action": "wbgetentities",
            "ids": "|".join(qids[i:i + 50]),
            "props": "sitelinks",
            "sitefilter": "enwiki",
            "format": "json",
        }
        r = requests.get(WIKIDATA_API, params=params, headers=HEADERS)
        r.raise_for_status()
        for qid, ent in r.json().get("entities", {}).items():
            link = ent.get("sitelinks", {}).get("enwiki")
            if link:
                titles[qid] = link["title"].replace(" ", "_")
    return titles


def main(src, dst):
    g = Graph()
    g.parse(src, format="nt")

    qids = set()
    for stmt in g.subjects(RDF.type, RDF.Statement):
        for p in (RDF.subject, RDF.object):
            o = str(g.value(stmt, p))
            if o.startswith(WD_ENTITY):
                qids.add(o[len(WD_ENTITY):])

    titles = enwiki_titles(qids)
    missing = sorted(qids - titles.keys())

    out = Graph()
    for s, p, o in g:
        if p in (RDF.subject, RDF.object) and str(o).startswith(WD_ENTITY):
            qid = str(o)[len(WD_ENTITY):]
            if qid in titles:
                o = URIRef(DBR + titles[qid])
        out.add((s, p, o))
    out.serialize(dst, format="nt", encoding="utf-8")

    print(f"{len(qids)} entities, {len(titles)} mapped to enwiki, {len(missing)} without article")
    if missing:
        print("no enwiki article:", " ".join(missing))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
